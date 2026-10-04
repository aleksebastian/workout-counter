import type {
	CatalogBundle,
	CatalogData,
	CatalogExercise,
	CatalogKind,
	CatalogProgram,
	CatalogRoutine
} from './types';

/**
 * Synchronous lookups over a loaded catalog. Where the data came from — a
 * bundled module today, possibly Firestore later — is `loadCatalog`'s concern;
 * everything downstream works on this.
 */
export type Catalog = CatalogData & {
	exercise(id: string): CatalogExercise | null;
	routine(id: string): CatalogRoutine | null;
	program(id: string): CatalogProgram | null;
	/** The item plus everything it references, ready for `planImport`. */
	bundle(kind: CatalogKind, id: string): CatalogBundle | null;
};

export function createCatalog(data: CatalogData): Catalog {
	const exercises = new Map(data.exercises.map((e) => [e.id, e]));
	const routines = new Map(data.routines.map((r) => [r.id, r]));
	const programs = new Map(data.programs.map((p) => [p.id, p]));

	function bundle(kind: CatalogKind, id: string): CatalogBundle | null {
		const exerciseIds = new Set<string>();
		const routineIds = new Set<string>();
		const programIds = new Set<string>();

		const addRoutine = (routine: CatalogRoutine) => {
			routineIds.add(routine.id);
			for (const ex of routine.exercises) exerciseIds.add(ex.exerciseId);
		};

		if (kind === 'exercise') {
			if (!exercises.has(id)) return null;
			exerciseIds.add(id);
		} else if (kind === 'routine') {
			const routine = routines.get(id);
			if (!routine) return null;
			addRoutine(routine);
		} else {
			const program = programs.get(id);
			if (!program) return null;
			programIds.add(id);
			for (const item of program.schedule.flatMap((d) => d.items)) {
				if (item.type === 'exercise') {
					exerciseIds.add(item.exerciseId);
				} else {
					const routine = routines.get(item.routineId);
					if (routine) addRoutine(routine);
				}
			}
		}

		// A dangling reference is dropped here rather than failing the whole
		// bundle; the planner skips anything it can't resolve. The catalog tests
		// keep the bundled data free of them.
		const pick = <T>(ids: Set<string>, from: Map<string, T>) =>
			[...ids].map((i) => from.get(i)).filter((x): x is T => x !== undefined);

		return {
			root: { kind, id },
			exercises: pick(exerciseIds, exercises),
			routines: pick(routineIds, routines),
			programs: pick(programIds, programs)
		};
	}

	return {
		...data,
		exercise: (id) => exercises.get(id) ?? null,
		routine: (id) => routines.get(id) ?? null,
		program: (id) => programs.get(id) ?? null,
		bundle
	};
}
