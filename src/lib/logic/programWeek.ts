import { counted } from '$lib/utils';
import {
	daySessions,
	programDays,
	slotLabel,
	type Preferences,
	type Program,
	type ProgramDay,
	type ProgramItem,
	type ProgramSession,
	type SessionLog,
	type SessionSource,
	type Slot
} from '$lib/types';
import {
	buildPlan,
	entriesDone,
	sameSource,
	sessionName,
	targetLabel,
	type Lookups,
	type PlanEntry
} from '$lib/logic/training';
import type { PlanRow } from '$lib/logic/today';
import { estimateMinutes } from '$lib/logic/history';
import { restSeconds } from '$lib/logic/rest';
import { measureOf, measureTarget, type DistanceUnit } from '$lib/logic/measure';

/**
 * What a program's page shows of its week: each day's sessions to read and
 * start from, and the pieces its editor works with. Kept free of the session
 * store, so the rules can be tested on their own.
 */

/** "3 days a week", and how many sessions when some days have more than one. */
export function programSummary(program: Program): string {
	const dayCount = programDays(program).length;
	const sessionCount = program.schedule.reduce((n, d) => n + daySessions(d).length, 0);
	return [
		dayCount ? `${counted(dayCount, 'day')} a week` : 'nothing planned yet',
		sessionCount > dayCount ? counted(sessionCount, 'session') : null
	]
		.filter(Boolean)
		.join(' · ');
}

// ── Viewing ─────────────────────────────────────────────────────────────────

export type SessionView = {
	session: ProgramSession;
	source: Extract<SessionSource, { type: 'program' }>;
	plan: PlanEntry[];
	title: string;
	/** The routine a session is made of, when it's exactly one, to open from its header. */
	routineId: string | null;
	meta: string;
	/** Today's run of it, if any. */
	row: PlanRow | null;
	/** Per plan entry, whether today's run got its sets; empty when there's no run. */
	done: boolean[];
	/** Today's finished run, when it's done: not a later try ended early. */
	doneLog: SessionLog | null;
	/** It ended early today and is the workout that can pick up where it stopped. */
	resumable: boolean;
};

export type ViewContext = {
	lookups: Lookups;
	prefs: Preferences;
	logs: SessionLog[];
	/** Where each of today's sessions stands; on any other day nothing has happened yet. */
	todayRows: PlanRow[];
	/** When the workout in progress started, if one is. */
	liveStartedAt: number | undefined;
	/** Whether the workout for `source` ended earlier today and can be resumed. */
	canResume: (source: SessionSource) => boolean;
	now: number;
};

/** A day's sessions with something in them, ready to read. */
export function sessionViews(
	programId: string,
	day: number,
	sessions: ProgramSession[],
	ctx: ViewContext
): SessionView[] {
	const { lookups, logs } = ctx;
	return sessions
		.filter((s) => s.items.length > 0)
		.map((s) => {
			const source = { type: 'program', programId, day, sessionId: s.id } as const;
			const plan = buildPlan(source, lookups) ?? [];
			const only = s.items.length === 1 && s.items[0].type === 'routine' ? s.items[0] : null;
			const sets = plan.reduce((n, e) => n + (e.targetSets ?? 0), 0);
			const minutes = estimateMinutes(
				plan,
				(e) => restSeconds(e.routineId ? lookups.routine(e.routineId) : null, ctx.prefs),
				logs,
				source
			).minutes;
			const row = ctx.todayRows.find((r) => r.session.id === s.id) ?? null;
			// Ticks only for the run under way or the one ended early.
			const since =
				row?.status === 'live'
					? ctx.liveStartedAt
					: row?.status === 'partial'
						? row.log?.startedAt
						: undefined;
			return {
				session: s,
				source,
				plan,
				title: sessionName(
					s,
					(id) => lookups.routine(id),
					(id) => lookups.workout(id)
				),
				routineId: only?.routineId ?? null,
				meta: [
					only ? 'Routine' : null,
					counted(plan.length, 'exercise'),
					sets ? counted(sets, 'set') : null,
					`about ${minutes} min`
				]
					.filter(Boolean)
					.join(' · '),
				row,
				done: since === undefined ? [] : entriesDone(plan, lookups, since),
				doneLog:
					row?.status === 'done'
						? (logs.find(
								(l) =>
									l.complete &&
									sameSource(l.source, source) &&
									new Date(l.endedAt).toDateString() === new Date(ctx.now).toDateString()
							) ?? null)
						: null,
				resumable: row?.status === 'partial' && ctx.canResume(source)
			};
		});
}

/** Above a session's name: its time of day when the day has several, and where it stands. */
export function eyebrow(v: SessionView, sessionCount: number): string {
	const status =
		v.row?.status === 'live'
			? 'In progress'
			: v.row?.status === 'partial'
				? 'Ended early'
				: v.row?.upNext
					? 'Up next'
					: null;
	return [sessionCount > 1 ? slotLabel(v.session.slot) : null, status].filter(Boolean).join(' · ');
}

/** Green only for what to do now: the session up next today, or the one under way. */
export function startButton(v: SessionView, isToday: boolean): { label: string; primary: boolean } {
	const row = v.row;
	if (row?.status === 'live') return { label: 'Continue', primary: true };
	if (row?.status === 'partial')
		return { label: v.resumable ? 'Resume' : 'Start again', primary: row.upNext };
	if (row?.upNext) return { label: `Start ${v.title}`, primary: true };
	return { label: isToday ? 'Start' : 'Start now', primary: false };
}

/** A plan entry's per-set target, e.g. "3 × 8–12", or null when it has none. */
export function entryTarget(e: PlanEntry, lookups: Lookups, unit: DistanceUnit): string | null {
	return targetLabel(e, measureOf(lookups.workout(e.workoutId)), unit);
}

// ── Editing ─────────────────────────────────────────────────────────────────

/** A lone session without a slot doesn't need one; its chip invites setting it. */
export function chipLabel(s: ProgramSession, multi: boolean): string {
	return !s.slot && !multi ? 'Set a time' : slotLabel(s.slot);
}

export function itemName(item: ProgramItem, lookups: Lookups): string {
	return item.type === 'routine'
		? (lookups.routine(item.routineId)?.name ?? 'Routine')
		: (lookups.workout(item.workoutId)?.name ?? 'Exercise');
}

/** Under an item's name while editing: what a routine holds, or an exercise's per-set target. */
export function itemDetail(item: ProgramItem, lookups: Lookups, unit: DistanceUnit): string | null {
	if (item.type === 'routine') {
		return `Routine · ${counted(lookups.routine(item.routineId)?.exercises.length ?? 0, 'exercise')}`;
	}
	const measure = measureOf(lookups.workout(item.workoutId));
	return measure === 'reps' ? null : measureTarget(item, measure, unit);
}

/**
 * Items with keys for the sortable list. A session may list the same
 * exercise or routine twice, so the key counts repeats as well as the id.
 */
export function keyed(items: ProgramItem[]): { item: ProgramItem; key: string }[] {
	const seen = new Map<string, number>();
	return items.map((item) => {
		const id = item.type === 'routine' ? `r:${item.routineId}` : `w:${item.workoutId}`;
		const n = seen.get(id) ?? 0;
		seen.set(id, n + 1);
		return { item, key: `${id}#${n}` };
	});
}

export type PresentExercise = { workoutId: string; removable: boolean; note?: string };

/**
 * What the add sheet shows as already in a session: exercises scheduled
 * directly (removable there), then those that come with a scheduled routine
 * (shown for context — removing one means removing the routine).
 */
export function presentExercises(items: ProgramItem[], lookups: Lookups): PresentExercise[] {
	const direct = items.flatMap((item) =>
		item.type === 'exercise' ? [{ workoutId: item.workoutId, removable: true }] : []
	);
	const seen = new Set(direct.map((p) => p.workoutId));
	const viaRoutines = items.flatMap((item) => {
		if (item.type !== 'routine') return [];
		const routine = lookups.routine(item.routineId);
		return (routine?.exercises ?? []).flatMap((ex) => {
			if (seen.has(ex.workoutId)) return [];
			seen.add(ex.workoutId);
			return [{ workoutId: ex.workoutId, removable: false, note: `In ${routine!.name}` }];
		});
	});
	return [...direct, ...viaRoutines];
}

/**
 * What each slot already holds, so picking one says what it joins. `moving`
 * is the session being moved, which doesn't count against its own slot.
 */
export function takenSlots(
	sessions: ProgramSession[],
	moving: string | null,
	lookups: Lookups
): Partial<Record<Slot | 'anytime', string>> {
	const notes: Partial<Record<Slot | 'anytime', string>> = {};
	for (const s of sessions) {
		if (s.id === moving) continue;
		if (!s.items.length) continue;
		const key = s.slot ?? 'anytime';
		notes[key] ??= `Has ${sessionName(
			s,
			(id) => lookups.routine(id),
			(id) => lookups.workout(id)
		)}`;
	}
	return notes;
}

/** The schedule with one day's sessions replaced, dropping the day when none are left. */
export function withSessions(
	schedule: ProgramDay[],
	day: number,
	next: ProgramSession[]
): ProgramDay[] {
	if (next.length === 0) return schedule.filter((d) => d.day !== day);
	const entry: ProgramDay = { day, sessions: next };
	return schedule.some((d) => d.day === day)
		? schedule.map((d) => (d.day === day ? entry : d))
		: [...schedule, entry].sort((a, b) => a.day - b.day);
}
