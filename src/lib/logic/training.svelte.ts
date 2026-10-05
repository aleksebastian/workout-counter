import { formatDistanceToNow } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { sessions as repo } from '$lib/data';
import { session } from '$lib/session.svelte';
import { toaster } from '$lib/toast.svelte';
import { restTimer } from '$lib/logic/restTimer.svelte';
import {
	buildPlan,
	isStale,
	lastActivity,
	resolveIndex,
	sourceName,
	summarize,
	type Lookups,
	type PlanEntry
} from '$lib/logic/training';
import type { ActiveSession, SessionLog, SessionSource } from '$lib/types';

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
};

/** The history entry for a session, or `null` if it has no sets worth keeping. */
function toLog(
	s: ActiveSession,
	endedAt: number,
	endReason: SessionLog['endReason']
): SessionLog | null {
	const { exercises, totals } = summarize(buildPlan(s.source, lookups) ?? [], lookups, s.startedAt);
	if (totals.sets === 0) return null;
	return {
		id: s.id,
		source: s.source,
		name: s.name,
		startedAt: s.startedAt,
		endedAt,
		endReason,
		exercises,
		totals,
		createdAt: endedAt
	};
}

/** Only one abandoned-session close per session, however many times sweep runs. */
let sweptId: string | null = null;

export const training = {
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

	/** The source's current name, falling back to the one saved when it started. */
	get name(): string {
		const s = this.session;
		if (!s) return '';
		return sourceName(s.source, lookups) ?? s.name;
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
			currentIndex: 0
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

	/** Ends the workout by choice and returns what it amounted to, for the done screen. */
	finish(): SessionSummary | null {
		const s = this.session;
		if (!s) return null;
		const now = Date.now();
		const log = toLog(s, now, 'finished');
		repo.close(log);
		restTimer.stop();
		return {
			name: this.name,
			durationMs: now - s.startedAt,
			exercises: log?.exercises.length ?? 0,
			sets: log?.totals.sets ?? 0,
			reps: log?.totals.reps ?? 0
		};
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
		repo.close(toLog(s, last, 'abandoned'));
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
