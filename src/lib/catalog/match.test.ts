import { describe, it, expect } from 'vitest';
import { matchExercise, normalizeName } from './match';
import type { CatalogExercise } from './types';
import type { Set, Workout } from '$lib/types';

const benchPress: CatalogExercise = {
	id: 'barbell-bench-press',
	name: 'Barbell Bench Press',
	aliases: ['Bench Press', 'Bench'],
	muscles: ['chest'],
	equipment: 'barbell',
	instructions: '…'
};

function workout(id: string, name: string, extra: Partial<Workout> = {}): Workout {
	return { id, name, sets: [], createdAt: 0, ...extra };
}

function sets(n: number): Set[] {
	return Array.from({ length: n }, (_, i) => ({ id: `s${i}`, date: '', reps: 5 }));
}

describe('normalizeName', () => {
	it('ignores case, punctuation and spacing', () => {
		expect(normalizeName('  Pull-Up ')).toBe('pull up');
		expect(normalizeName('pull   up')).toBe('pull up');
		expect(normalizeName('Glutes & Hamstrings')).toBe('glutes hamstrings');
	});
});

describe('matchExercise', () => {
	it('matches an exact name with certainty', () => {
		const mine = workout('w1', 'barbell bench-press');
		expect(matchExercise(benchPress, [mine])).toEqual({ workout: mine, confidence: 'certain' });
	});

	it('prefers an earlier stamp over the name, so a renamed exercise still matches', () => {
		const renamed = workout('w1', 'Heavy Bench', { source: { catalogId: benchPress.id } });
		const sameName = workout('w2', 'Barbell Bench Press');
		expect(matchExercise(benchPress, [sameName, renamed])).toEqual({
			workout: renamed,
			confidence: 'certain'
		});
	});

	it('matches an alias only as a probable match', () => {
		const mine = workout('w1', 'Bench Press');
		expect(matchExercise(benchPress, [mine])).toEqual({ workout: mine, confidence: 'alias' });
	});

	it('picks the alias match with the most history', () => {
		const light = workout('w1', 'Bench', { sets: sets(2) });
		const main = workout('w2', 'Bench Press', { sets: sets(40) });
		expect(matchExercise(benchPress, [light, main])?.workout).toBe(main);
	});

	it('does not alias-match an exercise already tied to a different catalog entry', () => {
		const other = workout('w1', 'Bench Press', { source: { catalogId: 'dumbbell-bench-press' } });
		expect(matchExercise(benchPress, [other])).toBeNull();
	});

	it('returns null when nothing lines up', () => {
		expect(matchExercise(benchPress, [workout('w1', 'Incline Bench Press')])).toBeNull();
	});
});
