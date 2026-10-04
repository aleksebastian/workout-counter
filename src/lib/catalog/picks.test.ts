import { describe, it, expect } from 'vitest';
import { createCatalog } from './catalog';
import { resolvePicks } from './picks';
import type { CatalogExercise } from './types';
import type { Workout } from '$lib/types';

function exercise(id: string, name: string, aliases?: string[]): CatalogExercise {
	return { id, name, aliases, muscles: ['back'], equipment: 'barbell', instructions: '…' };
}

const catalog = createCatalog({
	exercises: [exercise('row', 'Barbell Row', ['Row']), exercise('squat', 'Back Squat')],
	routines: [],
	programs: []
});

const workout = (id: string, name: string): Workout => ({ id, name, sets: [], createdAt: 0 });
const library = (workouts: Workout[] = []) => ({ workouts, routines: [], programs: [] });

function opts() {
	let n = 0;
	return { newId: () => `new-${++n}`, now: 1000 };
}

describe('resolvePicks', () => {
	it('keeps library picks as they are, in pick order', () => {
		const lib = library([workout('a', 'A'), workout('b', 'B')]);
		const result = resolvePicks(
			[
				{ kind: 'library', workoutId: 'b' },
				{ kind: 'library', workoutId: 'a' }
			],
			lib,
			catalog,
			opts()
		);
		expect(result).toEqual({ workoutIds: ['b', 'a'], byPick: ['b', 'a'], create: [] });
	});

	it('creates a typed name as a new exercise', () => {
		const result = resolvePicks(
			[{ kind: 'new', name: '  Cable Fly ' }],
			library(),
			catalog,
			opts()
		);
		expect(result.create).toEqual([{ id: 'new-1', name: 'Cable Fly', sets: [], createdAt: 1000 }]);
		expect(result.workoutIds).toEqual(['new-1']);
	});

	it('creates a Discover exercise stamped with its catalog id', () => {
		const result = resolvePicks(
			[{ kind: 'catalog', catalogId: 'squat' }],
			library(),
			catalog,
			opts()
		);
		expect(result.create).toEqual([
			{
				id: 'new-1',
				name: 'Back Squat',
				sets: [],
				source: { catalogId: 'squat' },
				createdAt: 1000
			}
		]);
	});

	it('adds the Discover exercise separately when it only shares an alias with a library one', () => {
		const lib = library([workout('mine', 'Row')]);
		const result = resolvePicks([{ kind: 'catalog', catalogId: 'row' }], lib, catalog, opts());
		expect(result.create.map((w) => w.name)).toEqual(['Barbell Row']);
		expect(result.workoutIds).toEqual(['new-1']);
	});

	it('keeps timestamps increasing across mixed picks, preserving order in the library', () => {
		const result = resolvePicks(
			[
				{ kind: 'new', name: 'Cable Fly' },
				{ kind: 'catalog', catalogId: 'squat' },
				{ kind: 'new', name: 'Band Pull-Apart' }
			],
			library(),
			catalog,
			opts()
		);
		expect(result.create.map((w) => w.createdAt)).toEqual([1000, 1001, 1002]);
		expect(result.workoutIds).toEqual(['new-1', 'new-2', 'new-3']);
	});

	it('skips a catalog id that no longer exists', () => {
		const result = resolvePicks(
			[{ kind: 'catalog', catalogId: 'gone' }],
			library(),
			catalog,
			opts()
		);
		expect(result).toEqual({ workoutIds: [], byPick: [null], create: [] });
	});
});
