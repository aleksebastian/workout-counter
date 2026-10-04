import { v4 as uuidv4 } from 'uuid';
import type {
	Program,
	ProgramDay,
	ProgramItem,
	Routine,
	RoutineExercise,
	Workout
} from '$lib/types';
import { matchExercise, type Match } from './match';
import type { CatalogBundle, CatalogExercise, CatalogKind } from './types';

/**
 * Turns "add this catalog item" into the exact documents to write.
 *
 * Catalog items reference each other by slug; library items reference each
 * other by document id, and an exercise document also carries its whole set
 * history. So adding a routine is not a copy: every exercise is first matched
 * to one the user already has (see `match.ts`), the routine is rebuilt around
 * the resulting ids, and only what's genuinely missing is created.
 *
 * Pure — no Firestore, no session — so the rules are testable and the UI can
 * re-plan as the user flips an alias match, then hand the result to
 * `library.add` to write in one batch.
 */

export type Library = { workouts: Workout[]; routines: Routine[]; programs: Program[] };

export type ExerciseMatch = {
	exercise: CatalogExercise;
	/** The library exercise it lines up with, whether or not it's used. */
	match: Match | null;
	action: 'reuse' | 'create';
};

/** For an alias match: use the user's exercise, or add the catalog one alongside it. */
export type AliasChoice = 'mine' | 'new';

export type ImportPlan = {
	/** Where the added item lives in the library — new or existing — for navigation. */
	root: { kind: CatalogKind; id: string };
	/**
	 * The item is already in the library and nothing needs adding. Matching
	 * ignores set and rep targets, so a copy the user has since tuned still
	 * counts — re-adding it would only produce a "(2)" they didn't want.
	 */
	alreadyInLibrary: boolean;
	exercises: ExerciseMatch[];
	create: { workouts: Workout[]; routines: Routine[]; programs: Program[] };
	/** Existing exercises to tag with the catalog id they matched, so later adds match by id. */
	stamps: { workoutId: string; catalogId: string }[];
};

export type PlanOptions = {
	/** Keyed by catalog exercise id. Unlisted alias matches default to `mine`. */
	aliasChoices?: Record<string, AliasChoice>;
	newId?: () => string;
	now?: number;
};

/** The same comparison the name validators use, so a planned name never fails them later. */
const nameKey = (name: string) => name.trim().toLowerCase();

/** "Push Day" → "Push Day (2)" → "Push Day (3)", skipping names already taken. */
function freeName(base: string, taken: Set<string>): string {
	let name = base;
	for (let n = 2; taken.has(nameKey(name)); n++) name = `${base} (${n})`;
	taken.add(nameKey(name));
	return name;
}

/** Whether `name` is `base` or a numbered copy of it — "Push Day (2)". */
function isCopyOf(name: string, base: string): boolean {
	return nameKey(name).replace(/\s*\(\d+\)$/, '') === nameKey(base);
}

/** Order matters, targets don't: tuned rep ranges are still the same routine. */
function sameExercises(a: RoutineExercise[], b: RoutineExercise[]): boolean {
	return a.length === b.length && a.every((ex, i) => ex.workoutId === b[i].workoutId);
}

/** Which day holds which routines and exercises; labels and set targets are ignored. */
function scheduleKey(schedule: ProgramDay[]): string {
	return schedule
		.filter((d) => d.items.length > 0)
		.sort((a, b) => a.day - b.day)
		.map(
			(d) =>
				`${d.day}:` +
				d.items.map((i) => (i.type === 'routine' ? `r${i.routineId}` : `e${i.workoutId}`)).join(',')
		)
		.join('|');
}

export function planImport(
	bundle: CatalogBundle,
	library: Library,
	options: PlanOptions = {}
): ImportPlan {
	const newId = options.newId ?? uuidv4;
	// Consecutive timestamps keep created items in catalog order, since every
	// collection is listed by `createdAt`.
	let clock = options.now ?? Date.now();

	const create: ImportPlan['create'] = { workouts: [], routines: [], programs: [] };
	const stamps: ImportPlan['stamps'] = [];
	const exercises: ExerciseMatch[] = [];
	const created = new Set<string>();

	// ── Exercises ──────────────────────────────────────────────────────────────
	const workoutIdFor = new Map<string, string>();
	const workoutNames = new Set(library.workouts.map((w) => nameKey(w.name)));
	// Two catalog exercises must never collapse onto one library exercise, or a
	// routine would list it twice.
	const claimed = new Set<string>();

	for (const exercise of bundle.exercises) {
		const match = matchExercise(
			exercise,
			library.workouts.filter((w) => !claimed.has(w.id))
		);
		const reuse =
			match !== null &&
			(match.confidence === 'certain' || options.aliasChoices?.[exercise.id] !== 'new');

		if (reuse) {
			claimed.add(match.workout.id);
			workoutIdFor.set(exercise.id, match.workout.id);
			if (!match.workout.source) {
				stamps.push({ workoutId: match.workout.id, catalogId: exercise.id });
			}
		} else {
			const workout: Workout = {
				id: newId(),
				name: freeName(exercise.name, workoutNames),
				sets: [],
				source: { catalogId: exercise.id },
				createdAt: clock++
			};
			create.workouts.push(workout);
			created.add(workout.id);
			workoutIdFor.set(exercise.id, workout.id);
		}
		exercises.push({ exercise, match, action: reuse ? 'reuse' : 'create' });
	}

	// ── Routines ───────────────────────────────────────────────────────────────
	const routineIdFor = new Map<string, string>();
	const routineNames = new Set(library.routines.map((r) => nameKey(r.name)));

	for (const catalogRoutine of bundle.routines) {
		const list: RoutineExercise[] = catalogRoutine.exercises.flatMap(
			({ exerciseId, targetSets, minReps, maxReps }) => {
				const workoutId = workoutIdFor.get(exerciseId);
				if (!workoutId) return [];
				return [
					{
						workoutId,
						...(targetSets !== undefined && { targetSets }),
						...(minReps !== undefined && { minReps }),
						...(maxReps !== undefined && { maxReps })
					}
				];
			}
		);

		const existing = library.routines.find(
			(r) => isCopyOf(r.name, catalogRoutine.name) && sameExercises(r.exercises, list)
		);
		if (existing) {
			routineIdFor.set(catalogRoutine.id, existing.id);
			continue;
		}

		const routine: Routine = {
			id: newId(),
			name: freeName(catalogRoutine.name, routineNames),
			exercises: list,
			...(catalogRoutine.timer && { timer: catalogRoutine.timer }),
			source: { catalogId: catalogRoutine.id },
			createdAt: clock++
		};
		create.routines.push(routine);
		created.add(routine.id);
		routineIdFor.set(catalogRoutine.id, routine.id);
	}

	// ── Programs ───────────────────────────────────────────────────────────────
	const programIdFor = new Map<string, string>();
	const programNames = new Set(library.programs.map((p) => nameKey(p.name)));

	for (const catalogProgram of bundle.programs) {
		const schedule: ProgramDay[] = catalogProgram.schedule
			.map(({ day, label, items }) => ({
				day,
				...(label && { label }),
				items: items.flatMap((item): ProgramItem[] => {
					if (item.type === 'routine') {
						const routineId = routineIdFor.get(item.routineId);
						return routineId ? [{ type: 'routine', routineId }] : [];
					}
					const workoutId = workoutIdFor.get(item.exerciseId);
					return workoutId ? [{ type: 'exercise', workoutId, targetSets: item.targetSets }] : [];
				})
			}))
			.filter((d) => d.items.length > 0);

		const key = scheduleKey(schedule);
		const existing = library.programs.find(
			(p) => isCopyOf(p.name, catalogProgram.name) && scheduleKey(p.schedule) === key
		);
		if (existing) {
			programIdFor.set(catalogProgram.id, existing.id);
			continue;
		}

		const program: Program = {
			id: newId(),
			name: freeName(catalogProgram.name, programNames),
			schedule,
			source: { catalogId: catalogProgram.id },
			createdAt: clock++
		};
		create.programs.push(program);
		created.add(program.id);
		programIdFor.set(catalogProgram.id, program.id);
	}

	// ── Root ───────────────────────────────────────────────────────────────────
	const { kind, id } = bundle.root;
	const ids = { exercise: workoutIdFor, routine: routineIdFor, program: programIdFor }[kind];
	const rootId = ids.get(id);
	if (!rootId) throw new Error(`catalog ${kind} "${id}" is missing from its own bundle`);

	return {
		root: { kind, id: rootId },
		alreadyInLibrary: !created.has(rootId),
		exercises,
		create,
		stamps
	};
}

/** Firestore writes in a plan — a batch is capped at 500. */
export function planSize(plan: ImportPlan): number {
	const { workouts, routines, programs } = plan.create;
	return workouts.length + routines.length + programs.length + plan.stamps.length;
}
