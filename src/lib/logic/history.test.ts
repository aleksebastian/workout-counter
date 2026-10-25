import { describe, it, expect } from 'vitest';
import {
	estimateMinutes,
	historyFeed,
	isRecord,
	logDuration,
	recordIds,
	streakTarget,
	topSet,
	vsLast,
	volume,
	weekStartOf,
	weekDays,
	weekStreak,
	weekTotals
} from './history';
import type { Program, SessionLog, Set, Workout } from '$lib/types';

const T0 = Date.parse('2026-10-21T18:00:00'); // a Wednesday, local time
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString();
const DAY = 24 * 60;

let n = 0;
const set = (minutes: number, reps: number, weight?: number): Set => ({
	id: `s${n++}`,
	date: at(minutes),
	reps,
	...(weight ? { weight } : {})
});
const workout = (id: string, sets: Set[]): Workout => ({ id, name: id, sets, createdAt: 0 });

function log(id: string, start: number, end: number, workoutIds: string[]): SessionLog {
	return {
		id,
		source: { type: 'routine', routineId: 'r1' },
		name: 'Full Body A',
		startedAt: T0 + start * 60_000,
		endedAt: T0 + end * 60_000,
		endReason: 'finished',
		complete: true,
		exercises: workoutIds.map((w) => ({ workoutId: w, name: w, sets: 0, reps: 0 })),
		totals: { sets: 0, reps: 0 },
		createdAt: T0 + end * 60_000
	};
}

describe('isRecord', () => {
	const earlier = [set(-DAY, 10, 100), set(-DAY, 8, 110)];

	it('is never the first set', () => {
		expect(isRecord(set(0, 5, 50), [])).toBe(false);
	});

	it('beats the heaviest weight', () => {
		expect(isRecord(set(0, 1, 115), earlier)).toBe(true);
		expect(isRecord(set(0, 12, 105), earlier)).toBe(false);
	});

	it('matches the heaviest weight for more reps', () => {
		expect(isRecord(set(0, 9, 110), earlier)).toBe(true);
		expect(isRecord(set(0, 8, 110), earlier)).toBe(false);
	});

	it('beats the most reps for bodyweight work', () => {
		const pushups = [set(-DAY, 20), set(-DAY, 18)];
		expect(isRecord(set(0, 21), pushups)).toBe(true);
		expect(isRecord(set(0, 20), pushups)).toBe(false);
	});

	it('doesn’t count an unweighted set on a weighted exercise', () => {
		expect(isRecord(set(0, 50), earlier)).toBe(false);
	});
});

describe('volume and vsLast', () => {
	const bench = workout('bench', [set(-DAY, 10, 100), set(-DAY, 10, 100), set(0, 10, 120)]);

	it('adds reps × weight, with bodyweight as nothing', () => {
		expect(volume([set(0, 10, 100), set(0, 12)])).toBe(1000);
	});

	it('compares the top set with the previous session', () => {
		expect(vsLast(bench, [bench.sets[2]], 'lb')).toBe('+20 lb vs last');
	});

	it('falls back to reps at the same weight, then "same"', () => {
		const w = workout('w', [set(-DAY, 8, 90), set(0, 9, 90)]);
		expect(vsLast(w, [w.sets[1]], 'lb')).toBe('+1 rep');
		const same = workout('s', [set(-DAY, 8, 90), set(0, 8, 90)]);
		expect(vsLast(same, [same.sets[1]], 'lb')).toBe('same as last');
	});

	it('is null the first time', () => {
		const w = workout('w', [set(0, 8, 90)]);
		expect(vsLast(w, w.sets, 'lb')).toBeNull();
	});

	it('agrees with isRecord for every set', () => {
		const w = workout('w', [
			set(-3 * DAY, 10, 100),
			set(-2 * DAY, 8, 110),
			set(-DAY, 9, 110),
			set(0, 12, 100),
			set(1, 10, 115)
		]);
		const ids = recordIds(w, w.sets);
		for (const [i, s] of w.sets.entries()) {
			expect(ids.has(s.id)).toBe(isRecord(s, w.sets.slice(0, i)));
		}
	});

	it('marks the record sets of a session', () => {
		expect([...recordIds(bench, [bench.sets[2]])]).toEqual([bench.sets[2].id]);
	});
});

describe('historyFeed', () => {
	const bench = workout('bench', [set(1, 10, 100), set(2, 10, 120)]);
	const squat = workout('squat', [set(-DAY, 5, 50), set(-DAY + 1, 5, 50)]);
	const one = log('l1', 0, 30, ['bench']);

	it('makes a row per session and per exercise-day outside sessions, newest first', () => {
		const feed = historyFeed([one], [bench, squat]);
		expect(feed.map((r) => r.kind)).toEqual(['session', 'single']);
		const single = feed[1];
		expect(single.kind === 'single' && single.sets.length).toBe(2);
	});

	it('totals a session’s volume and duration', () => {
		const [row] = historyFeed([one], [bench]);
		expect(row.kind === 'session' && row.volume).toBe(2200);
		expect(row.kind === 'session' && row.durationMs).toBe(30 * 60_000);
	});

	it('leaves the workout in progress out of single sets', () => {
		const feed = historyFeed(
			[],
			[bench],
			[{ source: { type: 'routine', routineId: 'r1' }, start: T0, end: Infinity }]
		);
		expect(feed).toEqual([]);
	});
});

describe('the week', () => {
	it('starts on the chosen weekday', () => {
		expect(new Date(weekStartOf(T0, 0)).getDay()).toBe(0);
		expect(new Date(weekStartOf(T0, 1)).getDay()).toBe(1);
	});

	it('totals this week’s volume and workout time', () => {
		const w = workout('w', [set(0, 10, 100), set(-30 * DAY, 10, 100)]);
		const totals = weekTotals([log('l', 0, 45, ['w'])], [w], 0, T0 + 3_600_000);
		expect(totals).toEqual({ volume: 1000, durationMs: 45 * 60_000, meters: 0 });
	});

	it('targets the lower of the goal and the program’s planned days', () => {
		const program = {
			id: 'p',
			name: 'P',
			schedule: [1, 3, 5].map((day) => ({
				day,
				sessions: [{ id: 's', items: [{ type: 'routine', routineId: 'r' }] }]
			})),
			createdAt: 0
		} as Program;
		expect(streakTarget(4, program)).toBe(3);
		expect(streakTarget(2, program)).toBe(2);
		expect(streakTarget(4, null)).toBe(4);
	});

	it('counts weeks that reached the target, not failing this week early', () => {
		// Two days last week and two the week before; nothing yet this week.
		const times = [-5, -6, -12, -13].map((d) => T0 + d * DAY * 60_000);
		expect(weekStreak(times, 0, 2, T0)).toBe(2);
		expect(weekStreak(times, 0, 3, T0)).toBe(0);
	});
});

describe('estimateMinutes', () => {
	const plan = [{ workoutId: 'a', targetSets: 3 }, { workoutId: 'b' }];
	const source = { type: 'routine', routineId: 'r1' } as const;

	it('estimates from the plan before the first run', () => {
		// 6 sets × (90 s rest + 40 s) = 13 min, to the nearest 5.
		expect(estimateMinutes(plan, () => 90, [], source)).toEqual({ minutes: 15, measured: false });
	});

	it('averages past finished runs once there are some', () => {
		const logs = [log('a', 0, 40, []), log('b', 0, 50, [])];
		expect(estimateMinutes(plan, () => 90, logs, source)).toEqual({ minutes: 45, measured: true });
		expect(logDuration(logs[0])).toBe(40 * 60_000);
	});
});

describe('weekDays', () => {
	const item = { type: 'routine', routineId: 'r' } as const;
	const program: Program = {
		id: 'p',
		name: 'P',
		schedule: [
			{ day: 1, sessions: [{ id: 'mon', items: [item] }] },
			{
				day: 3,
				sessions: [
					{ id: 'am', slot: 'morning', items: [item] },
					{ id: 'pm', slot: 'evening', items: [item] },
					{ id: 'night', slot: 'night', items: [item] }
				]
			}
		],
		createdAt: 0
	};
	const done = (sessionId: string, day: number, endedAt: number, complete = true): SessionLog => ({
		...log(sessionId, 0, 0, []),
		source: { type: 'program', programId: 'p', day, sessionId },
		endedAt,
		complete
	});

	it('counts each day’s planned sessions and the ones done that day', () => {
		const logs = [
			done('am', 3, T0 - 9 * 3_600_000),
			done('pm', 3, T0),
			done('night', 3, T0, false)
		];
		const week = weekDays(program, logs, [T0], 0, T0);
		expect(week.map((d) => d.dow)).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(week[3]).toMatchObject({ planned: 3, done: 2, trained: true, today: true });
		expect(week[1]).toMatchObject({ planned: 1, done: 0, trained: false, today: false });
		expect(week[0]).toMatchObject({ planned: 0, done: 0 });
	});

	it('ignores another day’s workout of the same session', () => {
		const lastWeek = done('am', 3, T0 - 7 * DAY * 60_000);
		expect(weekDays(program, [lastWeek], [], 0, T0)[3].done).toBe(0);
	});

	it('starts the week on Monday when asked', () => {
		expect(weekDays(null, [], [], 1, T0).map((d) => d.dow)).toEqual([1, 2, 3, 4, 5, 6, 0]);
	});
});

describe('records by measure', () => {
	const timed = (minutes: number, fields: Partial<Set>): Set => ({ ...set(minutes, 0), ...fields });

	it('counts the longest time', () => {
		const earlier = [timed(0, { seconds: 1800 })];
		expect(isRecord(timed(1, { seconds: 1900 }), earlier, 'time')).toBe(true);
		expect(isRecord(timed(1, { seconds: 1700 }), earlier, 'time')).toBe(false);
	});

	it('counts the farthest distance or the best pace', () => {
		const earlier = [timed(0, { meters: 5000, seconds: 1800 })];
		expect(isRecord(timed(1, { meters: 6000, seconds: 2400 }), earlier, 'distance')).toBe(true);
		expect(isRecord(timed(1, { meters: 4000, seconds: 1200 }), earlier, 'distance')).toBe(true);
		expect(isRecord(timed(1, { meters: 4000, seconds: 1600 }), earlier, 'distance')).toBe(false);
	});

	it('counts the longest hold, or more reps at it', () => {
		const earlier = [timed(0, { reps: 10, holdSeconds: 5 })];
		expect(isRecord(timed(1, { reps: 8, holdSeconds: 6 }), earlier, 'hold')).toBe(true);
		expect(isRecord(timed(1, { reps: 12, holdSeconds: 5 }), earlier, 'hold')).toBe(true);
		expect(isRecord(timed(1, { reps: 10, holdSeconds: 5 }), earlier, 'hold')).toBe(false);
	});

	it('picks the set that stands for a session, and compares it with last time', () => {
		const run = (minutes: number, meters: number, seconds: number) =>
			timed(minutes, { meters, seconds });
		expect(topSet([run(0, 3000, 900), run(1, 5000, 1800)], 'distance')?.meters).toBe(5000);
		const w: Workout = {
			...workout('run', [run(-2 * DAY, 4800, 1700), run(0, 5200, 1710)]),
			measure: 'distance'
		};
		expect(vsLast(w, [w.sets[1]], 'lb', 'km')).toBe('+0.4 km vs last');
		const bike: Workout = {
			...workout('bike', [timed(-2 * DAY, { seconds: 1800 }), timed(0, { seconds: 1920 })]),
			measure: 'time'
		};
		expect(vsLast(bike, [bike.sets[1]], 'lb')).toBe('+2:00 vs last');
	});
});
