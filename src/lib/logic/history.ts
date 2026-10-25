import { counted } from '$lib/utils';
import {
	programDays,
	sessionsForDay,
	type Program,
	type SessionLog,
	type Set,
	type Workout
} from '$lib/types';
import {
	elapsedMs,
	previousSets,
	sameSource,
	type PlanEntry,
	type SessionWindow
} from './training';

/**
 * Rules for the History tab and Today's summaries: volume, personal records,
 * how a session compares with the last one, the feed of past workouts, and
 * the week's numbers. Plain data in, plain data out, so they can be tested
 * without Firestore. The stores they read live in `session.svelte.ts`.
 */

const timeOf = (set: Set) => Date.parse(set.date);
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** How long a logged workout took, less any time it spent ended before a resume. */
export const logDuration = (log: SessionLog) =>
	elapsedMs({ startedAt: log.startedAt, pausedMs: log.pausedMs ?? 0 }, log.endedAt);

/** Weight moved by one set: reps × weight. Bodyweight sets move nothing countable. */
export const setVolume = (set: Set) => set.reps * (set.weight ?? 0);

export const volume = (sets: Set[]) => sets.reduce((sum, s) => sum + setVolume(s), 0);

/**
 * Whether `set` is a personal record against every set logged before it. A
 * weighted set beats the heaviest weight so far, or matches it for more reps
 * than that weight has seen. A bodyweight set beats the most reps so far,
 * unless the exercise is otherwise trained with weight. A first set is a
 * start, not a record.
 */
export function isRecord(set: Set, earlier: Set[]): boolean {
	if (earlier.length === 0) return false;
	const weight = set.weight ?? 0;
	const heaviest = Math.max(...earlier.map((s) => s.weight ?? 0));
	if (weight > 0) {
		if (weight !== heaviest) return weight > heaviest;
		const atWeight = earlier.filter((s) => (s.weight ?? 0) === weight).map((s) => s.reps);
		return set.reps > Math.max(...atWeight);
	}
	if (heaviest > 0) return false;
	return set.reps > Math.max(...earlier.map((s) => s.reps));
}

/** The sets one session logged on an exercise, oldest first. */
export function sessionSets(
	workout: Workout | null,
	log: Pick<SessionLog, 'startedAt' | 'endedAt'>
) {
	return (workout?.sets ?? [])
		.filter((s) => timeOf(s) >= log.startedAt && timeOf(s) <= log.endedAt)
		.sort((a, b) => timeOf(a) - timeOf(b));
}

/** Every record set of an exercise, worked out once per version of it (a snapshot is a new object). */
const recordCache = new WeakMap<Workout, globalThis.Set<string>>();

/**
 * Ids of every set that was a record when logged, in one pass in time order
 * with running bests: the same rule as `isRecord`, without rescanning the
 * history for each set.
 */
function allRecords(workout: Workout): globalThis.Set<string> {
	const cached = recordCache.get(workout);
	if (cached) return cached;
	const ids = new globalThis.Set<string>();
	let heaviest = 0;
	let mostReps = -Infinity;
	let seen = 0;
	const repsAt = new Map<number, number>();
	for (const set of [...workout.sets].sort((a, b) => timeOf(a) - timeOf(b))) {
		const weight = set.weight ?? 0;
		if (seen > 0) {
			const beatsWeight =
				weight > 0 &&
				(weight > heaviest ||
					(weight === heaviest && set.reps > (repsAt.get(weight) ?? -Infinity)));
			const beatsReps = weight === 0 && heaviest === 0 && set.reps > mostReps;
			if (beatsWeight || beatsReps) ids.add(set.id);
		}
		seen++;
		heaviest = Math.max(heaviest, weight);
		mostReps = Math.max(mostReps, set.reps);
		repsAt.set(weight, Math.max(repsAt.get(weight) ?? -Infinity, set.reps));
	}
	recordCache.set(workout, ids);
	return ids;
}

/** Ids of the sets among `sets` that were records when logged. */
export function recordIds(workout: Workout, sets: Set[]): globalThis.Set<string> {
	const all = allRecords(workout);
	return new globalThis.Set(sets.filter((s) => all.has(s.id)).map((s) => s.id));
}

/** The set that best stands for a session: heaviest, then most reps. */
function topSet(sets: Set[]): Set | null {
	if (!sets.length) return null;
	return sets.reduce((a, b) => {
		const wa = a.weight ?? 0;
		const wb = b.weight ?? 0;
		return wb > wa || (wb === wa && b.reps > a.reps) ? b : a;
	});
}

/**
 * How an exercise's sets in one session compare with its previous session
 * anywhere (not only in the same routine): "+20 lb vs last", "+1 rep",
 * "same as last". `null` the first time it's done.
 */
export function vsLast(workout: Workout, sets: Set[], unit: string): string | null {
	if (!sets.length) return null;
	const before = previousSets(workout, timeOf(sets[0]));
	const now = topSet(sets);
	const then = topSet(before);
	if (!now || !then) return null;
	const dw = Math.round(((now.weight ?? 0) - (then.weight ?? 0)) * 10) / 10;
	if (dw !== 0) return `${dw > 0 ? '+' : '−'}${Math.abs(dw)} ${unit} vs last`;
	const dr = now.reps - then.reps;
	if (dr !== 0) return `${dr > 0 ? '+' : '−'}${counted(Math.abs(dr), 'rep')}`;
	return 'same as last';
}

// ── The feed ─────────────────────────────────────────────────────────────────

export type SessionRow = {
	kind: 'session';
	log: SessionLog;
	/** Newest activity, for ordering. */
	at: number;
	durationMs: number;
	/** From the exercises as they are now, so an edit or delete in History shows up. */
	sets: number;
	volume: number;
	/** Exercises with at least one record in this session. */
	records: number;
};

export type SingleRow = {
	kind: 'single';
	workout: Workout;
	/** One day's sets logged outside any workout, oldest first. */
	sets: Set[];
	at: number;
};

export type FeedRow = SessionRow | SingleRow;

/**
 * Past workouts, newest first. Each logged session is a row; sets logged
 * outside every session (one at a time, or before sessions were kept) are a
 * row per exercise per day. `extra` covers windows the logs don't, like the
 * workout in progress, whose sets aren't history yet.
 */
export function historyFeed(
	logs: SessionLog[],
	workouts: Workout[],
	extra: SessionWindow[] = []
): FeedRow[] {
	const byId = new Map(workouts.map((w) => [w.id, w]));
	const rows: FeedRow[] = logs.map((log) => {
		let vol = 0;
		let count = 0;
		let records = 0;
		for (const ex of log.exercises) {
			const workout = byId.get(ex.workoutId);
			if (!workout) continue;
			const sets = sessionSets(workout, log);
			count += sets.length;
			vol += volume(sets);
			if (recordIds(workout, sets).size) records++;
		}
		return {
			kind: 'session',
			log,
			at: log.endedAt,
			durationMs: logDuration(log),
			sets: count,
			volume: vol,
			records
		};
	});

	const windows = [
		...logs.map((l) => ({ start: l.startedAt, end: l.endedAt })),
		...extra.map((w) => ({ start: w.start, end: w.end }))
	];
	const claimed = (t: number) => windows.some((w) => t >= w.start && t <= w.end);
	for (const workout of workouts) {
		const days = new Map<string, Set[]>();
		for (const set of workout.sets) {
			if (claimed(timeOf(set))) continue;
			const key = new Date(set.date).toDateString();
			days.set(key, [...(days.get(key) ?? []), set]);
		}
		for (const sets of days.values()) {
			sets.sort((a, b) => timeOf(a) - timeOf(b));
			rows.push({ kind: 'single', workout, sets, at: timeOf(sets.at(-1)!) });
		}
	}

	return rows.sort((a, b) => b.at - a.at);
}

// ── The week ─────────────────────────────────────────────────────────────────

/** Midnight on the day that starts the week containing `at`. */
export function weekStartOf(at: number, weekStart: 0 | 1): number {
	const day = new Date(at);
	day.setHours(0, 0, 0, 0);
	day.setDate(day.getDate() - ((day.getDay() - weekStart + 7) % 7));
	return day.getTime();
}

/** Volume lifted and time spent in workouts this week. */
export function weekTotals(
	logs: SessionLog[],
	workouts: Workout[],
	weekStart: 0 | 1,
	now = Date.now()
): { volume: number; durationMs: number } {
	const from = weekStartOf(now, weekStart);
	const sets = workouts.flatMap((w) => w.sets.filter((s) => timeOf(s) >= from));
	const durationMs = logs
		.filter((l) => l.endedAt >= from)
		.reduce((sum, l) => sum + logDuration(l), 0);
	return { volume: volume(sets), durationMs };
}

/** One day on the week strip. */
export type WeekDay = {
	/** Midnight at the start of the day, epoch ms. */
	start: number;
	dow: number;
	/** Sessions the active program schedules that weekday. */
	planned: number;
	/** Of those, how many got every planned exercise's sets that day. */
	done: number;
	/** Any set was logged that day, which is what counts toward the streak. */
	trained: boolean;
	today: boolean;
};

/**
 * This week, day by day: what the active program planned, how many of those
 * sessions were done, and whether anything was trained at all. Any session,
 * or any set, counts the day for the streak; the per-session count only
 * drives the segmented ring.
 */
export function weekDays(
	program: Program | null,
	logs: SessionLog[],
	setTimes: number[],
	weekStart: 0 | 1,
	now = Date.now()
): WeekDay[] {
	const trainedOn = new globalThis.Set(setTimes.map((t) => new Date(t).toDateString()));
	const first = weekStartOf(now, weekStart);
	const todayKey = new Date(now).toDateString();
	return Array.from({ length: 7 }, (_, i) => {
		const date = new Date(first);
		date.setDate(date.getDate() + i);
		const key = date.toDateString();
		const dow = date.getDay();
		const sessions = program ? sessionsForDay(program, dow) : [];
		const done = sessions.filter((s) =>
			logs.some(
				(l) =>
					l.complete &&
					l.source.type === 'program' &&
					l.source.programId === program!.id &&
					l.source.day === dow &&
					l.source.sessionId === s.id &&
					new Date(l.endedAt).toDateString() === key
			)
		).length;
		return {
			start: date.getTime(),
			dow,
			planned: sessions.length,
			done,
			trained: trainedOn.has(key),
			today: key === todayKey
		};
	});
}

/**
 * Training days a week needs to count toward the streak: the weekly goal, or
 * the active program's planned days when that's fewer, so following a
 * three-day plan keeps a streak going even with a goal of four.
 */
export function streakTarget(weeklyGoal: number, program: Program | null): number {
	const planned = program ? programDays(program).length : 0;
	return planned > 0 ? Math.min(weeklyGoal, planned) : weeklyGoal;
}

/**
 * Consecutive weeks that reached `target` training days, ending this week or,
 * while this week is still short, last week. A week isn't failed before it's over.
 */
export function weekStreak(
	setTimes: number[],
	weekStart: 0 | 1,
	target: number,
	now = Date.now()
): number {
	const days = new Map<number, globalThis.Set<string>>();
	for (const t of setTimes) {
		const wk = weekStartOf(t, weekStart);
		if (!days.has(wk)) days.set(wk, new globalThis.Set());
		days.get(wk)!.add(new Date(t).toDateString());
	}
	const done = (wk: number) => (days.get(wk)?.size ?? 0) >= target;
	let cursor = weekStartOf(now, weekStart);
	if (!done(cursor)) cursor = weekStartOf(cursor - WEEK_MS / 2, weekStart);
	let count = 0;
	while (done(cursor)) {
		count++;
		// Half a week back lands safely in the previous week across DST shifts.
		cursor = weekStartOf(cursor - WEEK_MS / 2, weekStart);
	}
	return count;
}

// ── Time estimate ───────────────────────────────────────────────────────────

/** Time per set besides the rest: setting up and doing the reps. */
const SET_WORK_S = 40;

/**
 * About how long a workout takes, in minutes rounded to 5. Once it has been
 * run, the average of its last five finished runs; before that, every
 * planned set (3 for a free-form exercise) at its rest plus about 40 s.
 */
export function estimateMinutes(
	plan: PlanEntry[],
	restSeconds: (entry: PlanEntry) => number,
	logs: SessionLog[],
	source: SessionLog['source']
): { minutes: number; measured: boolean } {
	const past = logs
		.filter((l) => l.endReason === 'finished' && sameSource(l.source, source))
		.slice(0, 5);
	const round = (ms: number) => Math.max(5, Math.round(ms / 60_000 / 5) * 5);
	if (past.length) {
		const avg = past.reduce((sum, l) => sum + logDuration(l), 0) / past.length;
		return { minutes: round(avg), measured: true };
	}
	const seconds = plan.reduce(
		(sum, e) => sum + (e.targetSets ?? 3) * (restSeconds(e) + SET_WORK_S),
		0
	);
	return { minutes: round(seconds * 1000), measured: false };
}
