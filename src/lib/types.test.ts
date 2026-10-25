import { describe, it, expect } from 'vitest';
import {
	currentSlot,
	itemsForDay,
	nextScheduledDay,
	parseProgram,
	parseRoutine,
	parseSessionLog,
	parseWorkout,
	programDays,
	sessionsForDay,
	type Program
} from './types';

/**
 * These guard the store boundary against documents Firestore is perfectly happy
 * to hold but the types say cannot exist. The originating bug: programs written
 * before the weekly schedule existed have no `schedule` field, and every
 * `program.schedule.find(...)` in the app threw on them.
 */

describe('parseProgram', () => {
	it('gives a legacy document an empty schedule instead of throwing', () => {
		// Exactly the shape the app used to write: flat items pinned to weekdays.
		const legacy = {
			id: 'p1',
			name: 'Upper/Lower',
			days: [1, 3, 5],
			items: [{ type: 'exercise', workoutId: 'w1', targetSets: 3 }],
			createdAt: 1700000000000
		};

		const program = parseProgram(legacy, 'p1');

		expect(program.schedule).toEqual([]);
		expect(program.name).toBe('Upper/Lower');
		expect(() => programDays(program)).not.toThrow();
		expect(programDays(program)).toEqual([]);
		expect(itemsForDay(program, 1)).toEqual([]);
	});

	it('coerces a day missing its sessions, and a session missing its items', () => {
		// programDays() reads s.items.length, so coercing only the outer arrays
		// would still throw here.
		const program = parseProgram(
			{ id: 'p1', name: 'Split', schedule: [{ day: 2 }, { day: 3, sessions: [{ id: 's' }] }] },
			'p1'
		);

		expect(program.schedule[0].sessions).toEqual([]);
		expect(program.schedule[1].sessions[0].items).toEqual([]);
		expect(() => programDays(program)).not.toThrow();
		expect(programDays(program)).toEqual([]);
	});

	it('preserves a well-formed schedule', () => {
		const raw = {
			id: 'p1',
			name: 'Split',
			schedule: [
				{
					day: 2,
					sessions: [
						{
							id: 's1',
							slot: 'evening',
							label: 'Push',
							items: [{ type: 'exercise', workoutId: 'w1', targetSets: 3 }]
						}
					]
				}
			],
			createdAt: 5
		};

		const program = parseProgram(raw, 'p1');

		expect(programDays(program)).toEqual([2]);
		expect(itemsForDay(program, 2)).toHaveLength(1);
		expect(program.schedule[0].sessions[0]).toMatchObject({ slot: 'evening', label: 'Push' });
	});

	it('drops an unknown slot, listing the session as Anytime', () => {
		const program = parseProgram(
			{ schedule: [{ day: 1, sessions: [{ id: 's', slot: 'brunch', items: [] }] }] },
			'p1'
		);
		expect(program.schedule[0].sessions[0]).toEqual({ id: 's', items: [] });
	});

	it('falls back to the document id when the stored id is missing', () => {
		const program = parseProgram({ name: 'Nameless' }, 'doc-abc');
		expect(program.id).toBe('doc-abc');
	});

	it('survives a document with nothing usable in it', () => {
		const program: Program = parseProgram({}, 'p9');
		expect(program).toEqual({ id: 'p9', name: '', schedule: [], createdAt: 0 });
		expect(() => programDays(program)).not.toThrow();
	});
});

describe('parseWorkout', () => {
	it('gives a workout with no sets field an empty array', () => {
		const workout = parseWorkout({ id: 'w1', name: 'Bench', createdAt: 1 }, 'w1');
		expect(workout.sets).toEqual([]);
		expect(() => workout.sets.length).not.toThrow();
	});

	it('preserves existing sets and optional fields', () => {
		const workout = parseWorkout(
			{
				id: 'w1',
				name: 'Bench',
				notes: 'wrists',
				sets: [{ id: 's1', date: '2026-01-01T00:00:00.000Z', reps: 5 }],
				createdAt: 1
			},
			'w1'
		);
		expect(workout.sets).toHaveLength(1);
		expect(workout.notes).toBe('wrists');
	});
});

describe('parseRoutine', () => {
	it('gives a routine with no exercises field an empty array', () => {
		const routine = parseRoutine({ id: 'r1', name: 'Push', createdAt: 1 }, 'r1');
		expect(routine.exercises).toEqual([]);
	});

	it('preserves an existing timer override', () => {
		const routine = parseRoutine(
			{ id: 'r1', name: 'Push', exercises: [], timer: { minutes: 2, seconds: 0 }, createdAt: 1 },
			'r1'
		);
		expect(routine.timer).toEqual({ minutes: 2, seconds: 0 });
	});
});

describe('nextScheduledDay', () => {
	const program: Program = {
		id: 'p1',
		name: 'Full Body',
		schedule: [
			{ day: 1, sessions: [{ id: 's1', items: [{ type: 'routine', routineId: 'a' }] }] },
			{ day: 3, sessions: [{ id: 's3', items: [] }] },
			{ day: 5, sessions: [{ id: 's5', items: [{ type: 'routine', routineId: 'b' }] }] }
		],
		createdAt: 1
	};

	it('skips days with nothing scheduled', () => {
		expect(nextScheduledDay(program, 2)?.day).toBe(5);
	});

	it('wraps round the week, back to the same day last', () => {
		expect(nextScheduledDay(program, 5)?.day).toBe(1);
		expect(nextScheduledDay({ ...program, schedule: [program.schedule[0]] }, 1)?.day).toBe(1);
	});

	it('is null for an empty schedule', () => {
		expect(nextScheduledDay({ ...program, schedule: [] }, 0)).toBeNull();
	});
});

describe('sessionsForDay', () => {
	const item = { type: 'routine', routineId: 'r' } as const;
	const program: Program = {
		id: 'p1',
		name: 'Week',
		schedule: [
			{
				day: 6,
				sessions: [
					{ id: 'any', items: [item] },
					{ id: 'night', slot: 'night', items: [item] },
					{ id: 'empty', slot: 'midday', items: [] },
					{ id: 'am', slot: 'morning', items: [item] },
					{ id: 'pm', slot: 'evening', items: [item] },
					{ id: 'am2', slot: 'morning', items: [item] }
				]
			}
		],
		createdAt: 1
	};

	it('orders by slot, keeps ties in the order added, puts Anytime last and skips empty ones', () => {
		expect(sessionsForDay(program, 6).map((s) => s.id)).toEqual([
			'am',
			'am2',
			'pm',
			'night',
			'any'
		]);
	});

	it('is empty for a day with nothing scheduled', () => {
		expect(sessionsForDay(program, 0)).toEqual([]);
	});
});

describe('currentSlot', () => {
	const at = (h: number) => new Date(2026, 9, 24, h, 30);

	it('maps the clock onto the five slots', () => {
		expect([6, 11, 14, 17, 21, 23].map((h) => currentSlot(at(h)))).toEqual([
			'morning',
			'midday',
			'afternoon',
			'evening',
			'night',
			'night'
		]);
	});
});

describe('parseSessionLog', () => {
	it('reads a program session source and whether it was complete', () => {
		const log = parseSessionLog(
			{
				source: { type: 'program', programId: 'p', day: 2, sessionId: 's' },
				complete: true,
				startedAt: 1
			},
			'l1'
		);
		expect(log?.source).toEqual({ type: 'program', programId: 'p', day: 2, sessionId: 's' });
		expect(log?.complete).toBe(true);
	});

	it('drops a program source without a session', () => {
		expect(
			parseSessionLog({ source: { type: 'program', programId: 'p', day: 2 } }, 'l1')
		).toBeNull();
	});
});
