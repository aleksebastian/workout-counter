import { describe, it, expect } from 'vitest';
import { planImport, type Library } from '$lib/catalog/plan';
import type { CatalogExercise } from '$lib/catalog/types';
import type { Program, ProgramDay, Workout } from '$lib/types';
import {
	addSessions,
	daysLabel,
	daysSentence,
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
			days: [],
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

	it('turns HTML entities in names back into plain text', () => {
		const e = extraction([extracted('Curl &amp; Press')]);
		e.routine.name = 'Back &amp; Biceps';
		const draft = toDraft(e, [], 1);
		expect(draft.name).toBe('Back & Biceps');
		expect(draft.exercises[0].name).toBe('Curl & Press');
	});

	it('reads 7 as Sunday and drops anything else out of range', () => {
		const draft = toDraft(
			extraction([], { type: 'program', programId: 'ppl', days: [1, 2, 3, 4, 5, 6, 7, 9, -1] }),
			[program],
			3
		);
		expect(draft.destination).toMatchObject({ days: [0, 1, 2, 3, 4, 5, 6] });
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
			extraction([], { type: 'program', programId: 'ppl', days: [5, 1, 1, 9], slot: 'morning' }),
			[program],
			3
		);
		expect(draft.destination).toEqual({
			type: 'program',
			programId: 'ppl',
			newProgramName: '',
			days: [1, 5],
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
			days: [3]
		});
	});
});

describe('toDraft while programs load', () => {
	it("keeps the server-checked program until the user's programs arrive", () => {
		const draft = toDraft(
			extraction([], { type: 'program', programId: 'ppl', days: [1] }),
			null,
			3
		);
		expect(draft.destination).toMatchObject({ programId: 'ppl', newProgramName: '' });
	});
});

describe('catalog matching respects the measure', () => {
	it('a distance "Row" is not the Barbell Row it shares an alias with', () => {
		const rowCatalog: CatalogExercise[] = [
			{
				id: 'barbell-row',
				name: 'Barbell Row',
				aliases: ['Row'],
				muscles: ['back'],
				equipment: 'barbell',
				instructions: '…'
			}
		];
		const { bundle, unstamped } = draftBundle(
			{
				name: 'Cardio',
				destination: { type: 'routines' },
				exercises: [
					{ name: 'Row', measure: 'distance', targetMeters: 2000 },
					{ name: 'Row', targetSets: 4 }
				]
			},
			rowCatalog
		);
		expect(bundle.exercises.map((e) => e.id)).toEqual(['photo:row', 'barbell-row']);
		expect(bundle.exercises[0]).toMatchObject({ measure: 'distance' });
		expect(unstamped.has('photo:row')).toBe(true);
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

describe('addSessions', () => {
	const schedule: ProgramDay[] = [
		{ day: 1, sessions: [{ id: 's1', slot: 'morning', items: [] }] },
		{ day: 3, sessions: [] }
	];
	let n = 0;
	const newId = () => `new-${++n}`;

	it('adds one session per day, after any already there, adding missing days in order', () => {
		const next = addSessions(schedule, [1, 5, 0], 'morning', 'r1', newId);
		expect(next.map((d) => d.day)).toEqual([0, 1, 3, 5]);
		expect(next[1].sessions.map((s) => s.id)).toEqual(['s1', 'new-1']);
		expect(next[3].sessions).toEqual([
			{ id: 'new-2', slot: 'morning', items: [{ type: 'routine', routineId: 'r1' }] }
		]);
		expect(schedule[0].sessions).toHaveLength(1);
	});

	it('skips a day that already runs the routine in that slot', () => {
		const existing: ProgramDay[] = [
			{
				day: 1,
				sessions: [{ id: 's1', slot: 'morning', items: [{ type: 'routine', routineId: 'r1' }] }]
			}
		];
		const next = addSessions(existing, [1, 3], 'morning', 'r1', () => 'new');
		expect(next[0].sessions.map((s) => s.id)).toEqual(['s1']);
		expect(next[1]).toMatchObject({ day: 3, sessions: [{ id: 'new' }] });
		// Another slot is a different session, so it's still added.
		expect(addSessions(existing, [1], 'evening', 'r1', () => 'pm')[0].sessions).toHaveLength(2);
	});

	it('leaves the slot off when none is given', () => {
		const [day] = addSessions([], [2], undefined, 'r1', () => 'x');
		expect(day.sessions).toEqual([{ id: 'x', items: [{ type: 'routine', routineId: 'r1' }] }]);
	});
});

describe('day labels', () => {
	it('names one day, lists several in week order, or says every day', () => {
		expect(daysLabel([1], 1)).toBe('Monday');
		expect(daysLabel([0, 1, 3, 5], 1)).toBe('Mon, Wed, Fri, Sun');
		expect(daysLabel([0, 1, 3, 5], 0)).toBe('Sun, Mon, Wed, Fri');
		expect(daysLabel([0, 1, 2, 3, 4, 5, 6], 0)).toBe('Every day');
		expect(daysSentence([5, 1], 1)).toBe('Monday and Friday');
	});
});
