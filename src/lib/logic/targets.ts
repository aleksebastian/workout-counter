import type { RoutineExercise } from '$lib/types';

/**
 * Rules for a routine exercise's targets: how many sets, and a rep range.
 * Kept out of the sheet so the stepping, typing and linking rules can be
 * tested without rendering it.
 */

export const TARGET_MIN = 1;
export const TARGET_MAX = 99;
/** Suggested range for an exercise that has never been configured. */
export const DEFAULT_REP_RANGE: RepRange = { min: 8, max: 12 };
/** Gap kept between min and max while max follows min. */
export const REP_RANGE_GAP = 4;

export type RepRange = { min: number; max: number };

/** Editing state for the targets sheet. */
export type TargetsDraft = {
	/** `null` means free-form: the user decides when to move on. */
	targetSets: number | null;
	/** Off means no rep range is saved. Kept while off so toggling back restores it. */
	rangeOn: boolean;
	range: RepRange;
	/** Max tracks min (min + gap) until the user sets max themselves. */
	maxLinked: boolean;
};

export const clampTarget = (n: number) => Math.max(TARGET_MIN, Math.min(TARGET_MAX, Math.round(n)));

/** Parses a typed value; `null` for blank or non-numeric input. */
export function parseTarget(text: string): number | null {
	if (text.trim() === '') return null;
	const n = Number(text);
	return Number.isFinite(n) ? n : null;
}

export function initialDraft(ex: RoutineExercise | undefined): TargetsDraft {
	const targetSets = ex?.targetSets ?? null;
	const min = ex?.minReps;
	const max = ex?.maxReps;
	const neverConfigured = targetSets === null && min === undefined && max === undefined;

	if (min !== undefined && max !== undefined) {
		const lo = clampTarget(Math.min(min, max));
		const hi = clampTarget(Math.max(min, max));
		return { targetSets, rangeOn: true, range: { min: lo, max: hi }, maxLinked: false };
	}
	// A half-set range (saved before both ends were required) gets its other end filled in.
	if (min !== undefined) {
		const lo = clampTarget(min);
		return {
			targetSets,
			rangeOn: true,
			range: { min: lo, max: clampTarget(lo + REP_RANGE_GAP) },
			maxLinked: true
		};
	}
	if (max !== undefined) {
		const hi = clampTarget(max);
		return {
			targetSets,
			rangeOn: true,
			range: { min: clampTarget(hi - REP_RANGE_GAP), max: hi },
			maxLinked: false
		};
	}
	// Nothing saved: suggest the default range for a fresh exercise, but respect an
	// exercise that was configured with sets and deliberately no range.
	return { targetSets, rangeOn: neverConfigured, range: { ...DEFAULT_REP_RANGE }, maxLinked: true };
}

/** Stepping up from free-form starts at 1; stepping below 1 returns to free-form. */
export function stepSets(current: number | null, delta: number): number | null {
	if (current === null) return delta > 0 ? TARGET_MIN : null;
	const next = current + delta;
	return next < TARGET_MIN ? null : clampTarget(next);
}

/** A blank or sub-1 value means free-form. */
export function commitSets(text: string): number | null {
	const n = parseTarget(text);
	return n === null || n < TARGET_MIN ? null : clampTarget(n);
}

export function setMin(draft: TargetsDraft, value: number): TargetsDraft {
	const min = clampTarget(value);
	let max = draft.maxLinked ? clampTarget(min + REP_RANGE_GAP) : draft.range.max;
	if (max < min) max = min;
	return { ...draft, range: { min, max } };
}

export function setMax(draft: TargetsDraft, value: number): TargetsDraft {
	const max = clampTarget(value);
	const min = Math.min(draft.range.min, max);
	return { ...draft, range: { min, max }, maxLinked: false };
}

/**
 * Live update while min is being typed: max follows if linked, but nothing is
 * clamped or cross-checked yet — "12" passes through "1" on its way.
 */
export function typingMin(draft: TargetsDraft, text: string): TargetsDraft {
	const n = parseTarget(text);
	if (n === null || n < TARGET_MIN || !draft.maxLinked) return draft;
	return { ...draft, range: { ...draft.range, max: clampTarget(n + REP_RANGE_GAP) } };
}

export function toSaved(
	draft: TargetsDraft
): Pick<RoutineExercise, 'targetSets' | 'minReps' | 'maxReps'> {
	return {
		targetSets: draft.targetSets ?? undefined,
		minReps: draft.rangeOn ? draft.range.min : undefined,
		maxReps: draft.rangeOn ? draft.range.max : undefined
	};
}
