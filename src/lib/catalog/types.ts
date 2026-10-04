import type { Duration } from '$lib/types';

/**
 * The Explore catalog: curated exercises, routines and programs a user can add
 * to their own library.
 *
 * Everything here is plain JSON-shaped data — no functions, no derived fields —
 * so the same records could be seeded into Firestore unchanged. Ids are stable
 * slugs ("barbell-bench-press"): they are stamped onto library items as
 * `source.catalogId`, so renaming or removing one orphans those stamps.
 */

export type Muscle =
	| 'chest'
	| 'back'
	| 'shoulders'
	| 'biceps'
	| 'triceps'
	| 'forearms'
	| 'core'
	| 'quads'
	| 'hamstrings'
	| 'glutes'
	| 'calves';

export type Equipment = 'barbell' | 'dumbbell' | 'kettlebell' | 'cable' | 'machine' | 'bodyweight';

export type Level = 'beginner' | 'intermediate' | 'advanced';

export type CatalogExercise = {
	id: string;
	name: string;
	/**
	 * Other names people log this exercise under. A library exercise matching an
	 * alias is only a *probable* match — the user confirms it before its history
	 * is shared — so keep aliases to names that genuinely mean this movement.
	 */
	aliases?: string[];
	/** Primary movers first. */
	muscles: Muscle[];
	equipment: Equipment;
	instructions: string;
};

/** Mirrors `RoutineExercise`, with a catalog exercise id in place of a workout id. */
export type CatalogRoutineExercise = {
	exerciseId: string;
	targetSets?: number;
	minReps?: number;
	maxReps?: number;
};

export type CatalogRoutine = {
	id: string;
	name: string;
	description: string;
	level: Level;
	exercises: CatalogRoutineExercise[];
	timer?: Duration;
};

/** Mirrors `ProgramItem`, with catalog ids in place of library ids. */
export type CatalogProgramItem =
	| { type: 'routine'; routineId: string }
	| { type: 'exercise'; exerciseId: string; targetSets: number };

export type CatalogProgramDay = {
	day: number; // 0=Sun … 6=Sat
	label?: string;
	items: CatalogProgramItem[];
};

export type CatalogProgram = {
	id: string;
	name: string;
	description: string;
	level: Level;
	schedule: CatalogProgramDay[];
};

export type CatalogData = {
	exercises: CatalogExercise[];
	routines: CatalogRoutine[];
	programs: CatalogProgram[];
};

export type CatalogKind = 'exercise' | 'routine' | 'program';

/**
 * One addable item plus everything it references — the unit the import planner
 * works on. Self-contained, so a bundle could equally come from somewhere other
 * than the curated catalog (a shared link, a coach) without the planner caring.
 */
export type CatalogBundle = {
	root: { kind: CatalogKind; id: string };
	exercises: CatalogExercise[];
	routines: CatalogRoutine[];
	programs: CatalogProgram[];
};
