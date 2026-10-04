import { describe, it, expect } from 'vitest';
import { catalogData } from './data';
import { createCatalog } from './catalog';
import { normalizeName } from './match';
import { planImport, planSize } from './plan';
import { TARGET_MAX, TARGET_MIN } from '$lib/logic/targets';

/**
 * Guards on the catalog *content*. Ids are stamped onto users' library items,
 * and names and aliases decide whose history gets reused, so a typo here is a
 * data bug in someone's library, not a cosmetic one.
 */

const { exercises, routines, programs } = catalogData;
const catalog = createCatalog(catalogData);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const emptyLibrary = { workouts: [], routines: [], programs: [] };

function duplicates(values: string[]): string[] {
	return values.filter((v, i) => values.indexOf(v) !== i);
}

describe.each([
	['exercises', exercises],
	['routines', routines],
	['programs', programs]
] as const)('catalog %s', (_, items) => {
	it('has slug ids', () => {
		expect(items.map((i) => i.id).filter((id) => !SLUG.test(id))).toEqual([]);
	});

	it('has unique ids', () => {
		expect(duplicates(items.map((i) => i.id))).toEqual([]);
	});

	it('has unique names', () => {
		expect(duplicates(items.map((i) => normalizeName(i.name)))).toEqual([]);
	});
});

describe('catalog exercises', () => {
	it('never share a name or alias with another exercise', () => {
		// An alias claimed by two exercises would let one library exercise match
		// both, and the user could not tell which history they were confirming.
		const owner = new Map<string, string>();
		const clashes: string[] = [];
		for (const ex of exercises) {
			for (const key of new Set([ex.name, ...(ex.aliases ?? [])].map(normalizeName))) {
				const other = owner.get(key);
				if (other && other !== ex.id) clashes.push(`"${key}": ${other} / ${ex.id}`);
				owner.set(key, ex.id);
			}
		}
		expect(clashes).toEqual([]);
	});

	it('all list at least one muscle and some instructions', () => {
		expect(exercises.filter((e) => !e.muscles.length || !e.instructions.trim())).toEqual([]);
	});
});

describe('catalog routines', () => {
	it.each(routines.map((r) => [r.id, r] as const))('%s is well-formed', (_, routine) => {
		expect(routine.exercises.length).toBeGreaterThan(0);
		for (const ex of routine.exercises) {
			expect(catalog.exercise(ex.exerciseId), ex.exerciseId).not.toBeNull();
			if (ex.targetSets !== undefined) {
				expect(ex.targetSets).toBeGreaterThanOrEqual(TARGET_MIN);
				expect(ex.targetSets).toBeLessThanOrEqual(TARGET_MAX);
			}
			if (ex.minReps !== undefined && ex.maxReps !== undefined) {
				expect(ex.minReps).toBeGreaterThanOrEqual(1);
				expect(ex.minReps).toBeLessThanOrEqual(ex.maxReps);
			}
		}
		// A routine listing an exercise twice can't be represented in the library.
		expect(duplicates(routine.exercises.map((e) => e.exerciseId))).toEqual([]);
	});
});

describe('catalog programs', () => {
	it.each(programs.map((p) => [p.id, p] as const))('%s is well-formed', (_, program) => {
		const days = program.schedule.map((d) => d.day);
		expect(duplicates(days.map(String))).toEqual([]);
		expect(days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)).toBe(true);
		expect(program.schedule.some((d) => d.items.length > 0)).toBe(true);
		for (const item of program.schedule.flatMap((d) => d.items)) {
			if (item.type === 'routine') {
				expect(catalog.routine(item.routineId), item.routineId).not.toBeNull();
			} else {
				expect(catalog.exercise(item.exerciseId), item.exerciseId).not.toBeNull();
				expect(item.targetSets).toBeGreaterThanOrEqual(TARGET_MIN);
			}
		}
	});
});

describe('every catalog item', () => {
	const all = [
		...exercises.map((e) => ['exercise', e.id] as const),
		...routines.map((r) => ['routine', r.id] as const),
		...programs.map((p) => ['program', p.id] as const)
	];

	it.each(all)('%s %s adds cleanly to an empty library', (kind, id) => {
		const bundle = catalog.bundle(kind, id)!;
		const plan = planImport(bundle, emptyLibrary);
		expect(plan.alreadyInLibrary).toBe(false);
		// Nothing referenced was dropped on the way to the library.
		expect(plan.create.workouts).toHaveLength(bundle.exercises.length);
		expect(plan.create.routines).toHaveLength(bundle.routines.length);
		expect(planSize(plan)).toBeLessThanOrEqual(500);
	});
});
