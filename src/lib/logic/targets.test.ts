import { describe, it, expect } from 'vitest';
import {
	commitSets,
	initialDraft,
	setMax,
	setMin,
	stepSets,
	toSaved,
	typingMin,
	type TargetsDraft
} from './targets';

const draft = (overrides: Partial<TargetsDraft> = {}): TargetsDraft => ({
	targetSets: null,
	rangeOn: true,
	range: { min: 8, max: 12 },
	maxLinked: true,
	...overrides
});

describe('initialDraft', () => {
	it('suggests 8–12 for an exercise that was never configured', () => {
		expect(initialDraft({ workoutId: 'w' })).toEqual(draft());
	});

	it('leaves the range off when sets were set without one', () => {
		expect(initialDraft({ workoutId: 'w', targetSets: 3 })).toMatchObject({
			targetSets: 3,
			rangeOn: false
		});
	});

	it('loads a saved range without linking max to min', () => {
		expect(initialDraft({ workoutId: 'w', minReps: 6, maxReps: 15 })).toEqual(
			draft({ range: { min: 6, max: 15 }, maxLinked: false })
		);
	});

	it('fills in the missing end of a half-set range', () => {
		expect(initialDraft({ workoutId: 'w', minReps: 10 }).range).toEqual({ min: 10, max: 14 });
		expect(initialDraft({ workoutId: 'w', maxReps: 12 }).range).toEqual({ min: 8, max: 12 });
		expect(initialDraft({ workoutId: 'w', maxReps: 3 }).range).toEqual({ min: 1, max: 3 });
	});
});

describe('sets', () => {
	it('steps in and out of free-form', () => {
		expect(stepSets(null, 1)).toBe(1);
		expect(stepSets(null, -1)).toBeNull();
		expect(stepSets(1, -1)).toBeNull();
		expect(stepSets(99, 1)).toBe(99);
	});

	it('treats a blank or zero typed value as free-form', () => {
		expect(commitSets('')).toBeNull();
		expect(commitSets('0')).toBeNull();
		expect(commitSets('4')).toBe(4);
		expect(commitSets('250')).toBe(99);
	});
});

describe('rep range', () => {
	it('moves max with min while linked', () => {
		expect(setMin(draft(), 6).range).toEqual({ min: 6, max: 10 });
		expect(setMin(draft(), 10).range).toEqual({ min: 10, max: 14 });
	});

	it('stops linking once max is set by hand', () => {
		const custom = setMax(draft(), 15);
		expect(custom.maxLinked).toBe(false);
		expect(setMin(custom, 10).range).toEqual({ min: 10, max: 15 });
	});

	it('keeps min ≤ max in both directions', () => {
		const unlinked = draft({ maxLinked: false });
		expect(setMin(unlinked, 20).range).toEqual({ min: 20, max: 20 });
		expect(setMax(draft(), 5).range).toEqual({ min: 5, max: 5 });
	});

	it('clamps to 1–99', () => {
		expect(setMin(draft(), 0).range.min).toBe(1);
		expect(setMin(draft(), 98).range).toEqual({ min: 98, max: 99 });
	});

	it('does not cross-check while min is mid-typing', () => {
		expect(typingMin(draft(), '1').range).toEqual({ min: 8, max: 5 });
		expect(typingMin(draft(), '12').range).toEqual({ min: 8, max: 16 });
		expect(typingMin(draft(), '').range).toEqual({ min: 8, max: 12 });
		expect(typingMin(draft({ maxLinked: false }), '12').range).toEqual({ min: 8, max: 12 });
	});
});

describe('toSaved', () => {
	it('saves the range only when it is on', () => {
		expect(toSaved(draft({ targetSets: 3 }))).toEqual({ targetSets: 3, minReps: 8, maxReps: 12 });
		expect(toSaved(draft({ rangeOn: false }))).toEqual({
			targetSets: undefined,
			minReps: undefined,
			maxReps: undefined
		});
	});
});
