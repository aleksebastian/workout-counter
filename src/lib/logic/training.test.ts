import { describe, it, expect } from 'vitest';
import {
	STALE_AFTER_MS,
	buildPlan,
	isPlanComplete,
	isStale,
	lastActivity,
	resolveIndex,
	sameSource,
	sourceFromParams,
	summarize,
	type Lookups
} from './training';
import type { ActiveSession, Program, Routine, Workout } from '$lib/types';

const T0 = Date.parse('2026-10-04T18:00:00Z');
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString();

function workout(id: string, setTimes: number[] = []): Workout {
	return {
		id,
		name: id.toUpperCase(),
		sets: setTimes.map((m, i) => ({ id: `${id}${i}`, date: at(m), reps: 10 })),
		createdAt: 0
	};
}

const push: Routine = {
	id: 'push',
	name: 'Push',
	exercises: [{ workoutId: 'bench', targetSets: 3 }, { workoutId: 'ohp' }],
	createdAt: 0
};

const split: Program = {
	id: 'split',
	name: 'Split',
	schedule: [
		{
			day: 1,
			items: [
				{ type: 'routine', routineId: 'push' },
				{ type: 'exercise', workoutId: 'curl', targetSets: 2 }
			]
		}
	],
	createdAt: 0
};

function lookups(workouts: Workout[] = []): Lookups {
	const byId = new Map(workouts.map((w) => [w.id, w]));
	return {
		routine: (id) => (id === 'push' ? push : null),
		program: (id) => (id === 'split' ? split : null),
		workout: (id) => byId.get(id) ?? null
	};
}

function session(extra: Partial<ActiveSession> = {}): ActiveSession {
	return {
		id: 's1',
		source: { type: 'routine', routineId: 'push' },
		name: 'Push',
		startedAt: T0,
		lastActiveAt: T0,
		currentWorkoutId: 'bench',
		currentIndex: 0,
		...extra
	};
}

describe('buildPlan', () => {
	it('expands a routine', () => {
		expect(buildPlan({ type: 'routine', routineId: 'push' }, lookups())).toEqual([
			{ workoutId: 'bench', targetSets: 3, routineId: 'push' },
			{ workoutId: 'ohp', targetSets: undefined, routineId: 'push' }
		]);
	});

	it('expands a program day, labelling routine groups', () => {
		const plan = buildPlan({ type: 'program', programId: 'split', day: 1 }, lookups());
		expect(plan?.map((e) => [e.workoutId, e.groupLabel, e.targetSets])).toEqual([
			['bench', 'Push', 3],
			['ohp', 'Push', undefined],
			['curl', undefined, 2]
		]);
	});

	it('is null when the source no longer exists', () => {
		expect(buildPlan({ type: 'routine', routineId: 'gone' }, lookups())).toBeNull();
		expect(buildPlan({ type: 'program', programId: 'gone', day: 1 }, lookups())).toBeNull();
	});
});

describe('sourceFromParams', () => {
	it('reads routine and program links, defaulting the day to today', () => {
		expect(sourceFromParams(new URLSearchParams('routine=push'), 3)).toEqual({
			type: 'routine',
			routineId: 'push'
		});
		expect(sourceFromParams(new URLSearchParams('program=split&day=1'), 3)).toEqual({
			type: 'program',
			programId: 'split',
			day: 1
		});
		expect(sourceFromParams(new URLSearchParams('program=split'), 3)).toMatchObject({ day: 3 });
		expect(sourceFromParams(new URLSearchParams(''), 3)).toBeNull();
	});
});

describe('sameSource', () => {
	it('compares the routine, or the program and its day', () => {
		const r = { type: 'routine', routineId: 'push' } as const;
		const p = { type: 'program', programId: 'split', day: 1 } as const;
		expect(sameSource(r, { ...r })).toBe(true);
		expect(sameSource(p, { ...p })).toBe(true);
		expect(sameSource(p, { ...p, day: 2 })).toBe(false);
		expect(sameSource(r, p)).toBe(false);
	});
});

describe('resolveIndex', () => {
	const plan = buildPlan({ type: 'routine', routineId: 'push' }, lookups())!;

	it('uses the saved position when it still holds that exercise', () => {
		expect(resolveIndex(plan, { currentWorkoutId: 'ohp', currentIndex: 1 })).toBe(1);
	});

	it('follows the exercise when the plan was reordered', () => {
		expect(resolveIndex(plan, { currentWorkoutId: 'ohp', currentIndex: 0 })).toBe(1);
	});

	it('falls back to the saved position, clamped, when the exercise was removed', () => {
		expect(resolveIndex(plan, { currentWorkoutId: 'gone', currentIndex: 1 })).toBe(1);
		expect(resolveIndex(plan, { currentWorkoutId: 'gone', currentIndex: 9 })).toBe(1);
	});
});

describe('lastActivity and isStale', () => {
	const plan = buildPlan({ type: 'routine', routineId: 'push' }, lookups())!;

	it('takes the latest set logged on a planned exercise since the start', () => {
		const lib = lookups([workout('bench', [-30, 5, 40]), workout('other', [90])]);
		expect(lastActivity(session(), plan, lib)).toBe(T0 + 40 * 60_000);
	});

	it('falls back to the last move when no set was logged', () => {
		expect(lastActivity(session({ lastActiveAt: T0 + 7 }), plan, lookups())).toBe(T0 + 7);
	});

	it('goes stale only after two hours without activity', () => {
		expect(isStale(T0, T0 + STALE_AFTER_MS)).toBe(false);
		expect(isStale(T0, T0 + STALE_AFTER_MS + 1)).toBe(true);
	});
});

describe('summarize', () => {
	it("counts only the session's sets, once per exercise", () => {
		const plan = buildPlan({ type: 'program', programId: 'split', day: 1 }, lookups())!;
		// An earlier workout the same day must not count — the old "today" bug.
		const lib = lookups([
			workout('bench', [-120, 1, 4]),
			workout('ohp', []),
			workout('curl', [20])
		]);
		expect(summarize(plan, lib, T0)).toEqual({
			exercises: [
				{ workoutId: 'bench', name: 'BENCH', sets: 2, reps: 20 },
				{ workoutId: 'curl', name: 'CURL', sets: 1, reps: 10 }
			],
			totals: { sets: 3, reps: 30 }
		});
	});
});

describe('isPlanComplete', () => {
	const plan = buildPlan({ type: 'routine', routineId: 'push' }, lookups())!;

	it('is complete once each exercise meets its target, free-form needing one set', () => {
		const lib = lookups([workout('bench', [1, 2, 3]), workout('ohp', [4])]);
		expect(isPlanComplete(plan, lib, T0)).toBe(true);
	});

	it('is not complete when a target is short', () => {
		const lib = lookups([workout('bench', [1, 2]), workout('ohp', [4])]);
		expect(isPlanComplete(plan, lib, T0)).toBe(false);
	});

	it('is not complete when a free-form exercise was never done', () => {
		const lib = lookups([workout('bench', [1, 2, 3]), workout('ohp', [])]);
		expect(isPlanComplete(plan, lib, T0)).toBe(false);
	});

	it('ignores sets from before the session started', () => {
		const lib = lookups([workout('bench', [-30, -20, 1]), workout('ohp', [4])]);
		expect(isPlanComplete(plan, lib, T0)).toBe(false);
	});
});
