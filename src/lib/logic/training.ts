import {
	itemsForDay,
	type ActiveSession,
	type Program,
	type Routine,
	type SessionLog,
	type SessionSource,
	type Set,
	type Workout
} from '$lib/types';

/**
 * Rules for a guided training session, kept free of Firestore and the session
 * store so they can be tested on their own. The stateful side — starting,
 * moving, closing — lives in `training.svelte.ts`.
 */

/** No set logged and no move between exercises for this long: the workout was abandoned. */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

export type PlanEntry = {
	workoutId: string;
	/** undefined = free-form: the user decides when to move on. */
	targetSets?: number;
	groupLabel?: string;
	groupProgress?: { current: number; total: number };
	/** The routine this entry comes from, whose rest timer applies. */
	routineId?: string;
};

export type Lookups = {
	routine(id: string): Routine | null;
	program(id: string): Program | null;
	workout(id: string): Workout | null;
};

function expandRoutine(routine: Routine, grouped: boolean): PlanEntry[] {
	return routine.exercises.map((ex, idx) => ({
		workoutId: ex.workoutId,
		targetSets: ex.targetSets,
		routineId: routine.id,
		...(grouped
			? {
					groupLabel: routine.name,
					groupProgress: { current: idx + 1, total: routine.exercises.length }
				}
			: {})
	}));
}

/**
 * The ordered exercises a session runs through, or `null` when its routine or
 * program no longer exists. A routine run is the routine expanded; a program
 * day may mix routines and one-off exercises, so both funnel into one shape.
 */
export function buildPlan(source: SessionSource, lookups: Lookups): PlanEntry[] | null {
	if (source.type === 'routine') {
		const routine = lookups.routine(source.routineId);
		return routine ? expandRoutine(routine, false) : null;
	}
	const program = lookups.program(source.programId);
	if (!program) return null;
	return itemsForDay(program, source.day).flatMap((item) => {
		if (item.type === 'exercise') return [{ workoutId: item.workoutId, targetSets: item.targetSets }];
		const routine = lookups.routine(item.routineId);
		return routine ? expandRoutine(routine, true) : [];
	});
}

export function sourceName(source: SessionSource, lookups: Lookups): string | null {
	return source.type === 'routine'
		? (lookups.routine(source.routineId)?.name ?? null)
		: (lookups.program(source.programId)?.name ?? null);
}

export function sameSource(a: SessionSource, b: SessionSource): boolean {
	if (a.type === 'routine' && b.type === 'routine') return a.routineId === b.routineId;
	if (a.type === 'program' && b.type === 'program') {
		return a.programId === b.programId && a.day === b.day;
	}
	return false;
}

/** `/train/run?routine=…` or `?program=…&day=…` (day defaults to today). */
export function sourceFromParams(params: URLSearchParams, today: number): SessionSource | null {
	const routineId = params.get('routine');
	if (routineId) return { type: 'routine', routineId };
	const programId = params.get('program');
	if (!programId) return null;
	const day = parseInt(params.get('day') ?? '', 10);
	return { type: 'program', programId, day: Number.isInteger(day) ? day : today };
}

/**
 * Where the user is in the plan: the exercise they were on, wherever it now
 * sits, or the saved position if it has since been removed.
 */
export function resolveIndex(
	plan: PlanEntry[],
	session: Pick<ActiveSession, 'currentWorkoutId' | 'currentIndex'>
): number {
	if (plan.length === 0) return 0;
	const atSaved = plan[session.currentIndex];
	if (atSaved && atSaved.workoutId === session.currentWorkoutId) return session.currentIndex;
	const found = plan.findIndex((e) => e.workoutId === session.currentWorkoutId);
	if (found !== -1) return found;
	return Math.min(Math.max(session.currentIndex, 0), plan.length - 1);
}

/**
 * The session's sets for one exercise: those logged since it started. Not
 * "today's" — that broke running a routine twice in a day, and any session
 * that crossed midnight.
 */
export function setsSince(workout: Workout | null, since: number): Set[] {
	return workout?.sets.filter((s) => new Date(s.date).getTime() >= since) ?? [];
}

/** The latest sign of life: a move between exercises, or a set logged on a planned exercise. */
export function lastActivity(session: ActiveSession, plan: PlanEntry[], lookups: Lookups): number {
	let latest = session.lastActiveAt;
	for (const id of new globalThis.Set(plan.map((e) => e.workoutId))) {
		for (const set of setsSince(lookups.workout(id), session.startedAt)) {
			latest = Math.max(latest, new Date(set.date).getTime());
		}
	}
	return latest;
}

export function isStale(lastActiveAt: number, now: number): boolean {
	return now - lastActiveAt > STALE_AFTER_MS;
}

/** Sets and reps per exercise for the session, in plan order, once each. */
export function summarize(
	plan: PlanEntry[],
	lookups: Lookups,
	since: number
): Pick<SessionLog, 'exercises' | 'totals'> {
	const exercises: SessionLog['exercises'] = [];
	for (const id of new globalThis.Set(plan.map((e) => e.workoutId))) {
		const workout = lookups.workout(id);
		const sets = setsSince(workout, since);
		if (!workout || sets.length === 0) continue;
		exercises.push({
			workoutId: id,
			name: workout.name,
			sets: sets.length,
			reps: sets.reduce((sum, s) => sum + s.reps, 0)
		});
	}
	return {
		exercises,
		totals: {
			sets: exercises.reduce((sum, e) => sum + e.sets, 0),
			reps: exercises.reduce((sum, e) => sum + e.reps, 0)
		}
	};
}
