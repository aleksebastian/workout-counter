import { v4 as uuidv4 } from 'uuid';
import type { Workout } from '$lib/types';
import type { Catalog } from './catalog';
import { planImport, type Library } from './plan';

/**
 * Turns what the user ticked in the add-exercises sheet into library workout
 * ids, creating whatever doesn't exist yet. Pure, so the caller can write the
 * new documents and the routine (or program day) in one batch.
 */

export type ExercisePick =
	| { kind: 'library'; workoutId: string }
	/** A Discover exercise. The sheet only offers ones with no certain match in the library. */
	| { kind: 'catalog'; catalogId: string }
	/** Typed into search with no match anywhere. */
	| { kind: 'new'; name: string };

export type ResolvedPicks = {
	/** In the order picked, without duplicates. */
	workoutIds: string[];
	/** The id each pick resolved to, aligned with the input (`null` if it no longer exists). */
	byPick: (string | null)[];
	/** Exercise documents to create before anything references them. */
	create: Workout[];
};

export function resolvePicks(
	picks: ExercisePick[],
	library: Library,
	catalog: Catalog | null,
	options: { newId?: () => string; now?: number } = {}
): ResolvedPicks {
	const newId = options.newId ?? uuidv4;
	let clock = options.now ?? Date.now();
	const create: Workout[] = [];
	const byPick: (string | null)[] = [];

	for (const pick of picks) {
		if (pick.kind === 'library') {
			byPick.push(pick.workoutId);
		} else if (pick.kind === 'new') {
			const workout: Workout = {
				id: newId(),
				name: pick.name.trim(),
				sets: [],
				createdAt: clock++
			};
			create.push(workout);
			byPick.push(workout.id);
		} else {
			const bundle = catalog?.bundle('exercise', pick.catalogId);
			if (!bundle) {
				byPick.push(null);
				continue;
			}
			// Picking the Discover entry over a library exercise that only shares
			// an alias ("Row" vs Barbell Row) is a deliberate choice of the catalog
			// one, so it's added as its own exercise. Exercises created earlier in
			// this same pick count as library, so nothing is created twice.
			const plan = planImport(
				bundle,
				{ ...library, workouts: [...library.workouts, ...create] },
				{ aliasChoices: { [pick.catalogId]: 'new' }, newId, now: clock }
			);
			clock += plan.create.workouts.length;
			create.push(...plan.create.workouts);
			byPick.push(plan.root.id);
		}
	}

	const workoutIds = [...new Set(byPick.filter((id): id is string => id !== null))];
	return { workoutIds, byPick, create };
}
