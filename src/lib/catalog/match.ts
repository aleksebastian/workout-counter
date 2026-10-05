import type { Workout } from '$lib/types';
import type { CatalogExercise } from './types';

/**
 * How a catalog exercise lines up with one already in the user's library.
 *
 * Reusing the library exercise keeps one continuous history — run mode
 * pre-fills the next set from the last one logged, so a fresh duplicate would
 * start every lift at zero. But merging two *different* movements corrupts that
 * history, so how sure we are decides whether the user is asked:
 *
 * - `certain` — the same catalog id was stamped on it by an earlier add, or the
 *   names match. Reused silently; exercise names are unique in the library, so
 *   a same-named exercise could not be created alongside it anyway.
 * - `alias`   — it's logged under one of the catalog exercise's other names
 *   ("Row" for Barbell Row). Probably the same thing, so it is reused by
 *   default, but the user can choose to add a separate exercise instead.
 */
export type Confidence = 'certain' | 'alias';

export type Match = { workout: Workout; confidence: Confidence };

/** Case, spacing and punctuation-insensitive: "Pull-Up" = "pull up". */
export function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

export function matchExercise(exercise: CatalogExercise, workouts: Workout[]): Match | null {
	const stamped = workouts.find((w) => w.source?.catalogId === exercise.id);
	if (stamped) return { workout: stamped, confidence: 'certain' };

	const name = normalizeName(exercise.name);
	const named = workouts.find((w) => normalizeName(w.name) === name);
	if (named) return { workout: named, confidence: 'certain' };

	// An exercise already stamped with a different catalog id is known to be a
	// different movement, whatever it is called.
	const aliases = new Set((exercise.aliases ?? []).map(normalizeName));
	const candidates = workouts.filter((w) => !w.source && aliases.has(normalizeName(w.name)));
	if (!candidates.length) return null;

	// "Row" and "Bent-Over Row" both logged: the one with more history is the
	// one the user actually trains.
	const best = candidates.reduce((a, b) => (b.sets.length > a.sets.length ? b : a));
	return { workout: best, confidence: 'alias' };
}
