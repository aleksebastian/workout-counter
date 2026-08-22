import { describe, it, expect } from 'vitest';
import {
	itemsForDay,
	parseProgram,
	parseRoutine,
	parseWorkout,
	programDays,
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

	it('coerces a day entry that is missing its items array', () => {
		// programDays() reads d.items.length, so coercing only the outer array
		// would still throw here.
		const program = parseProgram(
			{ id: 'p1', name: 'Split', schedule: [{ day: 2 }], createdAt: 1 },
			'p1'
		);

		expect(program.schedule[0].items).toEqual([]);
		expect(() => programDays(program)).not.toThrow();
		expect(programDays(program)).toEqual([]);
	});

	it('preserves a well-formed schedule', () => {
		const raw = {
			id: 'p1',
			name: 'Split',
			schedule: [
				{ day: 2, label: 'Push', items: [{ type: 'exercise', workoutId: 'w1', targetSets: 3 }] }
			],
			createdAt: 5
		};

		const program = parseProgram(raw, 'p1');

		expect(programDays(program)).toEqual([2]);
		expect(itemsForDay(program, 2)).toHaveLength(1);
		expect(program.schedule[0].label).toBe('Push');
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
