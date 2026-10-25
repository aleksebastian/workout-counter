import { formatDistanceToNow } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { sessions as repo } from '$lib/data';
import { session } from '$lib/session.svelte';
import { toaster } from '$lib/toast.svelte';
import { restTimer } from '$lib/logic/restTimer.svelte';
import {
	buildPlan,
	elapsedMs,
	endedToday,
	entriesDone,
	isPlanComplete,
	isStale,
	lastActivity,
	resolveIndex,
	resumedSession,
	runsRoutine,
	sameSource,
	setsSince,
	sourceName,
	sourceSlot,
	summarize,
	type Lookups,
	type PlanEntry,
	type SessionWindow
} from '$lib/logic/training';
import { pauseTimer, resumeTimer, startTimer } from '$lib/logic/setTimer';
import type {
	ActiveSession,
	EndedSession,
	SessionLog,
	SessionSource,
	Set,
	SetTimer
} from '$lib/types';

/**
 * The workout in progress. It's stored on the user document (see
 * `sessions` in `$lib/data`), so it outlives the run screen, an app restart,
 * or a switch of device; everything here reads it from the session store.
 *
 * Writes aren't awaited: Firestore applies them locally at once and only
 * settles the promise when the server confirms, so awaiting would freeze a
 * workout logged offline. Failures still surface as a toast via `mutate`.
 */

const lookups: Lookups = {
	routine: (id) => session.routine(id),
	program: (id) => session.program(id),
	workout: (id) => session.workout(id)
};

export type SessionSummary = {
	name: string;
	durationMs: number;
	exercises: number;
	sets: number;
	reps: number;
	/** Every planned exercise got its sets; false when the user ended early. */
	complete: boolean;
	/** When it began, for reading its sets back off their exercises. */
	startedAt: number;
	/** What each exercise got, in plan order. */
	list: SessionLog['exercises'];
};

/** The history entry for a session, or `null` if it has no sets worth keeping. */
function toLog(
	s: ActiveSession,
	endedAt: number,
	endReason: SessionLog['endReason']
): SessionLog | null {
	const plan = buildPlan(s.source, lookups) ?? [];
	const { exercises, totals } = summarize(plan, lookups, s.startedAt);
	if (totals.sets === 0) return null;
	return {
		id: s.id,
		source: s.source,
		name: s.name,
		startedAt: s.startedAt,
		endedAt,
		endReason,
		complete: isPlanComplete(plan, lookups, s.startedAt),
		...(sourceSlot(s.source, lookups) && { slot: sourceSlot(s.source, lookups) }),
		...(s.pausedMs > 0 && { pausedMs: s.pausedMs }),
		exercises,
		totals,
		createdAt: endedAt
	};
}

/**
 * What's kept of a workout once it ends, so it can be resumed later the
 * same day. Nothing for one that logged no sets: there's nothing to go
 * back to.
 */
function toEnded(
	s: ActiveSession,
	endedAt: number,
	log: SessionLog | null,
	complete: boolean
): EndedSession | null {
	if (!log) return null;
	return {
		id: s.id,
		source: s.source,
		name: s.name,
		startedAt: s.startedAt,
		currentWorkoutId: s.currentWorkoutId,
		currentIndex: s.currentIndex,
		pausedMs: s.pausedMs,
		endedAt,
		complete
	};
}

/** How far an ended workout got, for the cards that offer to resume it. */
export type EndedToday = { complete: boolean; done: number; total: number };

/** Only one abandoned-session close per session, however many times sweep runs. */
let sweptId: string | null = null;

export const training = {
	/** Routine, program and exercise lookups over the live library. */
	get lookups(): Lookups {
		return lookups;
	},

	/** The workout in progress, or `null`. */
	get session(): ActiveSession | null {
		return session.data?.activeSession ?? null;
	},

	/** Its exercises in order; `null` if there's no session or its source was deleted. */
	get plan(): PlanEntry[] | null {
		const s = this.session;
		return s ? buildPlan(s.source, lookups) : null;
	},

	/** Where the user is in the plan. */
	get index(): number {
		const s = this.session;
		const plan = this.plan;
		return s && plan ? resolveIndex(plan, s) : 0;
	},

	/** Every planned exercise has had its sets, so finishing needs no "are you sure". */
	get complete(): boolean {
		const s = this.session;
		return !!s && isPlanComplete(this.plan ?? [], lookups, s.startedAt);
	},

	/** The source's current name, falling back to the one saved when it started. */
	get name(): string {
		const s = this.session;
		if (!s) return '';
		return sourceName(s.source, lookups) ?? s.name;
	},

	/** Epoch ms the elapsed clock counts from: the start, moved on by any time spent ended. */
	get clockStart(): number {
		const s = this.session;
		return s ? s.startedAt + s.pausedMs : Date.now();
	},

	/**
	 * The workout for `source` that ended earlier today, and how far it got —
	 * so its Start buttons can offer to pick it back up. `null` if there's
	 * none, or another workout is in progress.
	 */
	endedToday(source: SessionSource, now = Date.now()): EndedToday | null {
		if (this.session) return null;
		const last = endedToday(session.data?.lastSession, source, now);
		if (!last) return null;
		const plan = buildPlan(last.source, lookups) ?? [];
		const done = entriesDone(plan, lookups, last.startedAt).filter(Boolean).length;
		return { complete: last.complete, done, total: plan.length };
	},

	/**
	 * How far today's run of a routine got — in the workout in progress, or one
	 * that ended earlier today, either the routine itself or a program day that
	 * includes it — or `null` if it hasn't been run today.
	 */
	routineProgressToday(routineId: string, now = Date.now()): EndedToday | null {
		const s = this.session;
		const last = session.data?.lastSession;
		const run = s ?? (last && endedToday(last, last.source, now) ? last : null);
		if (!run || !runsRoutine(run.source, routineId, lookups)) return null;
		const plan = (buildPlan(run.source, lookups) ?? []).filter((e) => e.routineId === routineId);
		const done = entriesDone(plan, lookups, run.startedAt).filter(Boolean).length;
		return { complete: done === plan.length, done, total: plan.length };
	},

	/** Every stretch of time known to belong to one workout, for telling whose sets are whose. */
	windows(): SessionWindow[] {
		const logs = (session.sessionLogs ?? []).map((l) => ({
			source: l.source,
			start: l.startedAt,
			end: l.endedAt
		}));
		// The latest ended one may not be back from the history query yet.
		const last = session.data?.lastSession;
		const active = this.session;
		return [
			...logs,
			...(last ? [{ source: last.source, start: last.startedAt, end: last.endedAt }] : []),
			// Still going: every set from here on is its own.
			...(active ? [{ source: active.source, start: active.startedAt, end: Infinity }] : [])
		];
	},

	/** Puts the workout that ended earlier today back in progress, where it left off. */
	resume(now = Date.now()): boolean {
		const last = session.data?.lastSession;
		if (!last || this.session || !endedToday(last, last.source, now)) return false;
		const plan = buildPlan(last.source, lookups) ?? [];
		repo.resume(resumedSession(last, plan, lookups, now));
		return true;
	},

	/** Whether `source` is the workout in progress, so its Start buttons can say Resume. */
	isRunning(source: SessionSource): boolean {
		const s = this.session;
		return !!s && sameSource(s.source, source);
	},

	/** What a routine or program is called now, for naming one that isn't running yet. */
	nameOf(source: SessionSource): string | null {
		return sourceName(source, lookups);
	},

	start(source: SessionSource): ActiveSession {
		const plan = buildPlan(source, lookups) ?? [];
		const now = Date.now();
		const s: ActiveSession = {
			id: uuidv4(),
			source,
			name: sourceName(source, lookups) ?? '',
			startedAt: now,
			lastActiveAt: now,
			currentWorkoutId: plan[0]?.workoutId ?? null,
			currentIndex: 0,
			pausedMs: 0
		};
		repo.start(s);
		return s;
	},

	moveTo(index: number) {
		const plan = this.plan;
		if (!this.session || !plan?.length) return;
		const i = Math.min(Math.max(index, 0), plan.length - 1);
		repo.move({ currentWorkoutId: plan[i].workoutId, currentIndex: i, lastActiveAt: Date.now() });
	},

	/** The set timer of the workout in progress, if one is running or paused. */
	get timer(): SetTimer | null {
		return this.session?.timer ?? null;
	},

	startTimer(workoutId: string) {
		if (this.session) repo.setTimer(startTimer(workoutId, Date.now()));
	},

	pauseTimer() {
		const t = this.timer;
		if (t) repo.setTimer(pauseTimer(t, Date.now()));
	},

	resumeTimer() {
		const t = this.timer;
		if (t) repo.setTimer(resumeTimer(t, Date.now()));
	},

	clearTimer() {
		if (this.timer) repo.setTimer(null);
	},

	/** Ends the workout by choice and returns what it amounted to, for the done screen. */
	finish(): SessionSummary | null {
		const s = this.session;
		if (!s) return null;
		const now = Date.now();
		const log = toLog(s, now, 'finished');
		const complete = log?.complete ?? false;
		repo.close(log, toEnded(s, now, log, complete));
		restTimer.stop();
		return {
			name: this.name,
			durationMs: elapsedMs(s, now),
			exercises: log?.exercises.length ?? 0,
			sets: log?.totals.sets ?? 0,
			reps: log?.totals.reps ?? 0,
			complete,
			startedAt: s.startedAt,
			list: log?.exercises ?? []
		};
	},

	/** The sets logged in this workout, per planned exercise, for discarding. */
	get loggedSets(): { workoutId: string; sets: Set[] }[] {
		const s = this.session;
		if (!s) return [];
		const ids = new globalThis.Set((this.plan ?? []).map((e) => e.workoutId));
		return [...ids].map((workoutId) => ({
			workoutId,
			sets: setsSince(session.workout(workoutId), s.startedAt)
		}));
	},

	/** Ends the workout without keeping it: no history, and its sets deleted. */
	discard() {
		if (!this.session) return;
		repo.discard(this.loggedSets);
		restTimer.stop();
	},

	/**
	 * Closes a session nobody has touched for a long while (see
	 * `STALE_AFTER_MS`), keeping what was logged. It's recorded as ending at the
	 * last activity, not now, so its duration stays honest. Needs the library
	 * loaded, since sets logged count as activity.
	 */
	sweep(now = Date.now()) {
		const s = this.session;
		if (!s || !session.library || sweptId === s.id) return;
		const last = lastActivity(s, this.plan ?? [], lookups);
		if (!isStale(last, now)) return;
		sweptId = s.id;
		const log = toLog(s, last, 'abandoned');
		repo.close(log, toEnded(s, last, log, log?.complete ?? false));
		toaster.show({
			id: `session-abandoned-${s.id}`,
			type: 'info',
			timeout: 7000,
			dismissible: true,
			message: `${this.name || 'Your workout'} ended — last activity ${formatDistanceToNow(last, { addSuffix: true })}`
		});
	},

	/** Re-checks for an abandoned session whenever the app comes back to the foreground. */
	init() {
		const onVisible = () => {
			if (document.visibilityState === 'visible') this.sweep();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	}
};
