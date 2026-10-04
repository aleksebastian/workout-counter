import { describe, it, expect } from 'vitest';
import { createCatalog } from './catalog';
import { planImport, type Library, type PlanOptions } from './plan';
import type { CatalogData, CatalogExercise } from './types';
import type { Program, Routine, Workout } from '$lib/types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function exercise(id: string, name: string, aliases?: string[]): CatalogExercise {
	return { id, name, aliases, muscles: ['chest'], equipment: 'barbell', instructions: '…' };
}

const data: CatalogData = {
	exercises: [
		exercise('bench', 'Barbell Bench Press', ['Bench Press']),
		exercise('ohp', 'Overhead Press'),
		exercise('row', 'Barbell Row', ['Row']),
		exercise('squat', 'Back Squat')
	],
	routines: [
		{
			id: 'push',
			name: 'Push Day',
			description: '',
			level: 'intermediate',
			timer: { minutes: 2, seconds: 0 },
			exercises: [
				{ exerciseId: 'bench', targetSets: 4, minReps: 6, maxReps: 10 },
				{ exerciseId: 'ohp', targetSets: 3 }
			]
		},
		{
			id: 'pull',
			name: 'Pull Day',
			description: '',
			level: 'intermediate',
			exercises: [{ exerciseId: 'row', targetSets: 3 }]
		}
	],
	programs: [
		{
			id: 'split',
			name: 'Split',
			description: '',
			level: 'intermediate',
			schedule: [
				{ day: 1, label: 'Push', items: [{ type: 'routine', routineId: 'push' }] },
				{ day: 3, items: [{ type: 'routine', routineId: 'pull' }] },
				{
					day: 5,
					items: [
						{ type: 'routine', routineId: 'push' },
						{ type: 'exercise', exerciseId: 'squat', targetSets: 5 }
					]
				}
			]
		}
	]
};

const catalog = createCatalog(data);
const bundle = (kind: 'exercise' | 'routine' | 'program', id: string) => catalog.bundle(kind, id)!;

function library(partial: Partial<Library> = {}): Library {
	return { workouts: [], routines: [], programs: [], ...partial };
}

function workout(id: string, name: string, extra: Partial<Workout> = {}): Workout {
	return { id, name, sets: [], createdAt: 0, ...extra };
}

/** Deterministic ids and clock, so plans can be compared exactly. */
function opts(extra: PlanOptions = {}): PlanOptions {
	let n = 0;
	return { newId: () => `new-${++n}`, now: 1000, ...extra };
}

/** Folds a plan's writes into the library, as if the batch had committed. */
function apply(lib: Library, plan: ReturnType<typeof planImport>): Library {
	const stamped = new Map(plan.stamps.map((s) => [s.workoutId, s.catalogId]));
	return {
		workouts: [
			...lib.workouts.map((w) =>
				stamped.has(w.id) ? { ...w, source: { catalogId: stamped.get(w.id)! } } : w
			),
			...plan.create.workouts
		],
		routines: [...lib.routines, ...plan.create.routines],
		programs: [...lib.programs, ...plan.create.programs]
	};
}

// ── Exercises ────────────────────────────────────────────────────────────────

describe('planImport — exercises', () => {
	it('creates missing exercises with the catalog name and a provenance stamp', () => {
		const plan = planImport(bundle('exercise', 'ohp'), library(), opts());
		expect(plan.create.workouts).toEqual([
			{
				id: 'new-1',
				name: 'Overhead Press',
				sets: [],
				source: { catalogId: 'ohp' },
				createdAt: 1000
			}
		]);
		expect(plan.root).toEqual({ kind: 'exercise', id: 'new-1' });
		expect(plan.alreadyInLibrary).toBe(false);
	});

	it('reuses a same-named exercise silently, keeping its history, and stamps it', () => {
		const mine = workout('w1', 'overhead press');
		const plan = planImport(bundle('exercise', 'ohp'), library({ workouts: [mine] }), opts());
		expect(plan.create.workouts).toEqual([]);
		expect(plan.exercises[0]).toMatchObject({ action: 'reuse', match: { confidence: 'certain' } });
		expect(plan.stamps).toEqual([{ workoutId: 'w1', catalogId: 'ohp' }]);
		expect(plan.alreadyInLibrary).toBe(true);
	});

	it('does not re-stamp an exercise that already carries a stamp', () => {
		const mine = workout('w1', 'Overhead Press', { source: { catalogId: 'ohp' } });
		const plan = planImport(bundle('exercise', 'ohp'), library({ workouts: [mine] }), opts());
		expect(plan.stamps).toEqual([]);
	});

	it('reuses an alias match by default, flagged for confirmation', () => {
		const mine = workout('w1', 'Row');
		const plan = planImport(bundle('routine', 'pull'), library({ workouts: [mine] }), opts());
		expect(plan.exercises[0]).toMatchObject({ action: 'reuse', match: { confidence: 'alias' } });
		expect(plan.create.routines[0].exercises).toEqual([{ workoutId: 'w1', targetSets: 3 }]);
	});

	it('adds a separate exercise when the user rejects an alias match', () => {
		const mine = workout('w1', 'Row');
		const plan = planImport(
			bundle('routine', 'pull'),
			library({ workouts: [mine] }),
			opts({ aliasChoices: { row: 'new' } })
		);
		expect(plan.exercises[0]).toMatchObject({ action: 'create', match: { workout: mine } });
		expect(plan.create.workouts.map((w) => w.name)).toEqual(['Barbell Row']);
		expect(plan.stamps).toEqual([]);
		expect(plan.create.routines[0].exercises[0].workoutId).toBe('new-1');
	});

	it('cannot be talked out of a certain match', () => {
		const mine = workout('w1', 'Barbell Row');
		const plan = planImport(
			bundle('exercise', 'row'),
			library({ workouts: [mine] }),
			opts({ aliasChoices: { row: 'new' } })
		);
		expect(plan.create.workouts).toEqual([]);
	});

	it('never maps two catalog exercises onto one library exercise', () => {
		// Renamed after it was stamped, so it now collides with the other one's name.
		const mine = workout('w1', 'Overhead Press', { source: { catalogId: 'bench' } });
		const plan = planImport(bundle('routine', 'push'), library({ workouts: [mine] }), opts());
		const ids = plan.create.routines[0].exercises.map((e) => e.workoutId);
		expect(new Set(ids).size).toBe(2);
		// And the new one is numbered rather than breaking name uniqueness.
		expect(plan.create.workouts.map((w) => w.name)).toEqual(['Overhead Press (2)']);
	});
});

// ── Routines ─────────────────────────────────────────────────────────────────

describe('planImport — routines', () => {
	it('builds the routine around library ids, keeping targets and timer', () => {
		const plan = planImport(bundle('routine', 'push'), library(), opts());
		expect(plan.create.workouts.map((w) => [w.id, w.name])).toEqual([
			['new-1', 'Barbell Bench Press'],
			['new-2', 'Overhead Press']
		]);
		expect(plan.create.routines).toEqual([
			{
				id: 'new-3',
				name: 'Push Day',
				exercises: [
					{ workoutId: 'new-1', targetSets: 4, minReps: 6, maxReps: 10 },
					{ workoutId: 'new-2', targetSets: 3 }
				],
				timer: { minutes: 2, seconds: 0 },
				source: { catalogId: 'push' },
				createdAt: 1002
			}
		]);
		expect(plan.root).toEqual({ kind: 'routine', id: 'new-3' });
	});

	it('creates items in catalog order', () => {
		const plan = planImport(bundle('routine', 'push'), library(), opts());
		const times = plan.create.workouts.map((w) => w.createdAt);
		expect(times).toEqual([...times].sort((a, b) => a - b));
	});

	it('is already in the library once added', () => {
		const first = planImport(bundle('routine', 'push'), library(), opts());
		const again = planImport(bundle('routine', 'push'), apply(library(), first), opts());
		expect(again.alreadyInLibrary).toBe(true);
		expect(again.root.id).toBe(first.root.id);
		expect(again.create).toEqual({ workouts: [], routines: [], programs: [] });
	});

	it('still counts as the same routine after the user tunes its targets', () => {
		const first = planImport(bundle('routine', 'push'), library(), opts());
		const lib = apply(library(), first);
		lib.routines = lib.routines.map((r) => ({
			...r,
			exercises: r.exercises.map((e) => ({ ...e, targetSets: 5, minReps: 3, maxReps: 5 }))
		}));
		expect(planImport(bundle('routine', 'push'), lib, opts()).alreadyInLibrary).toBe(true);
	});

	it('adds a numbered copy when a same-named routine has different exercises', () => {
		const lib = apply(library(), planImport(bundle('routine', 'push'), library(), opts()));
		lib.routines = lib.routines.map((r) => ({ ...r, exercises: r.exercises.slice(0, 1) }));
		const plan = planImport(bundle('routine', 'push'), lib, opts());
		expect(plan.alreadyInLibrary).toBe(false);
		expect(plan.create.routines[0].name).toBe('Push Day (2)');
		// The exercises themselves are reused, not duplicated.
		expect(plan.create.workouts).toEqual([]);
	});

	it('skips numbers already taken, and recognises a numbered copy as identical', () => {
		const pushDay = (id: string, name: string, exercises: Routine['exercises']): Routine => ({
			id,
			name,
			exercises,
			createdAt: 0
		});
		const lib = library({
			workouts: [workout('b', 'Barbell Bench Press'), workout('o', 'Overhead Press')],
			routines: [pushDay('r1', 'Push Day', []), pushDay('r2', 'push day (2)', [])]
		});
		expect(planImport(bundle('routine', 'push'), lib, opts()).create.routines[0].name).toBe(
			'Push Day (3)'
		);

		lib.routines.push(pushDay('r3', 'Push Day (3)', [{ workoutId: 'b' }, { workoutId: 'o' }]));
		const plan = planImport(bundle('routine', 'push'), lib, opts());
		expect(plan.alreadyInLibrary).toBe(true);
		expect(plan.root.id).toBe('r3');
	});

	it('treats a different order as a different routine', () => {
		const lib = library({
			workouts: [workout('b', 'Barbell Bench Press'), workout('o', 'Overhead Press')],
			routines: [
				{
					id: 'r1',
					name: 'Push Day',
					exercises: [{ workoutId: 'o' }, { workoutId: 'b' }],
					createdAt: 0
				}
			]
		});
		expect(planImport(bundle('routine', 'push'), lib, opts()).alreadyInLibrary).toBe(false);
	});
});

// ── Programs ─────────────────────────────────────────────────────────────────

describe('planImport — programs', () => {
	it('creates each routine once, however many days use it', () => {
		const plan = planImport(bundle('program', 'split'), library(), opts());
		expect(plan.create.routines.map((r) => r.name)).toEqual(['Push Day', 'Pull Day']);
		expect(plan.create.workouts.map((w) => w.name)).toEqual([
			'Barbell Bench Press',
			'Overhead Press',
			'Barbell Row',
			'Back Squat'
		]);

		const [push, pull] = plan.create.routines.map((r) => r.id);
		const squat = plan.create.workouts[3].id;
		expect(plan.create.programs).toEqual([
			{
				id: plan.root.id,
				name: 'Split',
				schedule: [
					{ day: 1, label: 'Push', items: [{ type: 'routine', routineId: push }] },
					{ day: 3, items: [{ type: 'routine', routineId: pull }] },
					{
						day: 5,
						items: [
							{ type: 'routine', routineId: push },
							{ type: 'exercise', workoutId: squat, targetSets: 5 }
						]
					}
				],
				source: { catalogId: 'split' },
				createdAt: expect.any(Number)
			}
		]);
	});

	it('points at a routine the user already has instead of copying it', () => {
		const lib = apply(library(), planImport(bundle('routine', 'push'), library(), opts()));
		const existingPush = lib.routines[0].id;
		const plan = planImport(bundle('program', 'split'), lib, opts());
		expect(plan.create.routines.map((r) => r.name)).toEqual(['Pull Day']);
		expect(plan.create.programs[0].schedule[0].items).toEqual([
			{ type: 'routine', routineId: existingPush }
		]);
	});

	it('is already in the library once added, even with relabelled days', () => {
		const first = planImport(bundle('program', 'split'), library(), opts());
		const lib = apply(library(), first);
		lib.programs = lib.programs.map((p): Program => ({
			...p,
			schedule: p.schedule.map((d) => ({ ...d, label: 'Renamed' }))
		}));
		const again = planImport(bundle('program', 'split'), lib, opts());
		expect(again.alreadyInLibrary).toBe(true);
		expect(again.create).toEqual({ workouts: [], routines: [], programs: [] });
	});

	it('adds a numbered copy when the same-named program is scheduled differently', () => {
		const lib = apply(library(), planImport(bundle('program', 'split'), library(), opts()));
		lib.programs = lib.programs.map((p) => ({ ...p, schedule: p.schedule.slice(1) }));
		const plan = planImport(bundle('program', 'split'), lib, opts());
		expect(plan.create.programs[0].name).toBe('Split (2)');
		expect(plan.create.routines).toEqual([]);
	});
});
