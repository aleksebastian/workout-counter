import { describe, it, expect } from 'vitest';
import { planImport, type Library } from '$lib/catalog/plan';
import type { CatalogExercise } from '$lib/catalog/types';
import type { Program, ProgramDay, Workout } from '$lib/types';
import {
	addSession,
	draftBundle,
	toDraft,
	type Draft,
	type ExtractedExercise,
	type Extraction
} from './photo';

const catalog: CatalogExercise[] = [
	{
		id: 'bench',
		name: 'Barbell Bench Press',
		aliases: ['Bench Press', 'Bench'],
		muscles: ['chest'],
		equipment: 'barbell',
		instructions: '…'
	},
	{
		id: 'plank',
		name: 'Plank',
		muscles: ['core'],
		equipment: 'bodyweight',
		measure: 'hold',
		instructions: '…'
	}
];

function extracted(name: string, fields: Partial<ExtractedExercise> = {}): ExtractedExercise {
	return {
		name,
		measure: null,
		targetSets: null,
		minReps: null,
		maxReps: null,
		targetSeconds: null,
		targetMeters: null,
		holdSeconds: null,
		...fields
	};
}

function extraction(
	exercises: ExtractedExercise[],
	destination: Partial<Extraction['destination']> = {}
): Extraction {
	return {
		status: 'ok',
		routine: { name: 'Push Day', exercises },
		destination: {
			type: 'routines',
			programId: null,
			newProgramName: null,
			day: null,
			slot: null,
			...destination
		}
	};
}

const program: Program = { id: 'ppl', name: 'Push Pull Legs', schedule: [], createdAt: 1 };

describe('toDraft', () => {
	it('keeps targets in range and drops the rest', () => {
		const draft = toDraft(
			extraction([
				extracted(' Bench ', { targetSets: 4, minReps: 6, maxReps: 8 }),
				extracted('Curl', { targetSets: 0, minReps: 12, maxReps: 8 }),
				extracted('  ')
			]),
			[],
			1
		);
		expect(draft.exercises).toEqual([
			{ name: 'Bench', targetSets: 4, minReps: 6, maxReps: 8 },
			{ name: 'Curl', minReps: 12 }
		]);
	});

	it('keeps time and hold measures with their targets', () => {
		const draft = toDraft(
			extraction([
				extracted('Run', { measure: 'distance', targetMeters: 5000, targetSeconds: 1800 }),
				extracted('Wall sit', { measure: 'hold', targetSets: 3, holdSeconds: 45 })
			]),
			[],
			1
		);
		expect(draft.exercises).toEqual([
			{ name: 'Run', measure: 'distance', targetMeters: 5000, targetSeconds: 1800 },
			{ name: 'Wall sit', measure: 'hold', targetSets: 3, holdSeconds: 45 }
		]);
	});

	it('points at a program the user has, with its day and slot', () => {
		const draft = toDraft(
			extraction([], { type: 'program', programId: 'ppl', day: 1, slot: 'morning' }),
			[program],
			3
		);
		expect(draft.destination).toEqual({
			type: 'program',
			programId: 'ppl',
			newProgramName: '',
			day: 1,
			slot: 'morning'
		});
	});

	it('makes an unknown program a new one, on today when the day is missing', () => {
		const draft = toDraft(
			extraction([], { type: 'program', programId: 'nope', newProgramName: 'Summer', slot: null }),
			[program],
			3
		);
		expect(draft.destination).toEqual({
			type: 'program',
			programId: null,
			newProgramName: 'Summer',
			day: 3
		});
	});
});

describe('draftBundle + planImport', () => {
	const draft: Draft = {
		name: 'Push Day',
		destination: { type: 'routines' },
		exercises: [
			{ name: 'Bench', targetSets: 4, minReps: 6, maxReps: 8 },
			{ name: 'Cable Fly', targetSets: 3 },
			{ name: 'bench press' },
			{ name: 'Plank', targetSets: 3, holdSeconds: 30 }
		]
	};
	let n = 0;
	const newId = () => `new-${++n}`;

	it('matches catalog exercises by name or alias and keeps each once', () => {
		const { bundle } = draftBundle(draft, catalog);
		expect(bundle.exercises.map((e) => e.id)).toEqual(['bench', 'photo:cable fly', 'plank']);
		expect(bundle.routines[0].exercises).toEqual([
			{ exerciseId: 'bench', targetSets: 4, minReps: 6, maxReps: 8 },
			{ exerciseId: 'photo:cable fly', targetSets: 3 },
			{ exerciseId: 'plank', targetSets: 3, holdSeconds: 30 }
		]);
	});

	it('stamps catalog matches but never the made-up ids', () => {
		const library: Library = {
			workouts: [
				{ id: 'w-fly', name: 'cable fly', sets: [], createdAt: 1 },
				{ id: 'w-bench', name: 'Bench Press', sets: [], createdAt: 2 }
			] satisfies Workout[],
			routines: [],
			programs: []
		};
		const { bundle, unstamped } = draftBundle(draft, catalog);
		const plan = planImport(bundle, library, { unstamped, newId, now: 10 });

		expect(plan.stamps).toEqual([{ workoutId: 'w-bench', catalogId: 'bench' }]);
		expect(plan.create.workouts).toMatchObject([
			{ name: 'Plank', measure: 'hold', source: { catalogId: 'plank' } }
		]);
		const [routine] = plan.create.routines;
		expect(routine.source).toBeUndefined();
		expect(routine.exercises).toEqual([
			{ workoutId: 'w-bench', targetSets: 4, minReps: 6, maxReps: 8 },
			{ workoutId: 'w-fly', targetSets: 3 },
			{ workoutId: plan.create.workouts[0].id, targetSets: 3, holdSeconds: 30 }
		]);
	});

	it('creates an unknown exercise without a source', () => {
		const { bundle, unstamped } = draftBundle(draft, catalog);
		const plan = planImport(bundle, { workouts: [], routines: [], programs: [] }, { unstamped });
		const fly = plan.create.workouts.find((w) => w.name === 'Cable Fly');
		expect(fly).toBeDefined();
		expect(fly!.source).toBeUndefined();
	});
});

describe('addSession', () => {
	const schedule: ProgramDay[] = [
		{ day: 1, sessions: [{ id: 's1', slot: 'morning', items: [] }] },
		{ day: 3, sessions: [] }
	];

	it('adds a session after the ones already in the day', () => {
		const next = addSession(schedule, 1, 'morning', 'r1', () => 'new');
		expect(next[0].sessions).toEqual([
			{ id: 's1', slot: 'morning', items: [] },
			{ id: 'new', slot: 'morning', items: [{ type: 'routine', routineId: 'r1' }] }
		]);
		expect(schedule[0].sessions).toHaveLength(1);
	});

	it('adds a missing day in week order, with no slot when none is given', () => {
		const next = addSession(schedule, 2, undefined, 'r1', () => 'new');
		expect(next.map((d) => d.day)).toEqual([1, 2, 3]);
		expect(next[1].sessions).toEqual([
			{ id: 'new', items: [{ type: 'routine', routineId: 'r1' }] }
		]);
	});
});
