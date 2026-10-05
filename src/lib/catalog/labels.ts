import { normalizeName } from './match';
import type {
	Catalog,
	CatalogExercise,
	CatalogProgram,
	CatalogRoutine,
	Equipment,
	Level,
	Muscle
} from './index';

/** Display copy and browse helpers for Discover. */

export const MUSCLE_LABELS: Record<Muscle, string> = {
	chest: 'Chest',
	back: 'Back',
	shoulders: 'Shoulders',
	biceps: 'Biceps',
	triceps: 'Triceps',
	forearms: 'Forearms',
	core: 'Core',
	quads: 'Quads',
	hamstrings: 'Hamstrings',
	glutes: 'Glutes',
	calves: 'Calves'
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
	barbell: 'Barbell',
	dumbbell: 'Dumbbell',
	kettlebell: 'Kettlebell',
	cable: 'Cable',
	machine: 'Machine',
	bodyweight: 'Bodyweight'
};

export const LEVEL_LABELS: Record<Level, string> = {
	beginner: 'Beginner',
	intermediate: 'Intermediate',
	advanced: 'Advanced'
};

/**
 * Browse filters group muscles the way people think about a session ("arms",
 * "legs"), and match on an exercise's *primary* muscle only — otherwise bench
 * press would turn up under Arms for its triceps work.
 */
export const MUSCLE_FILTERS: { id: string; label: string; muscles: Muscle[] }[] = [
	{ id: 'chest', label: 'Chest', muscles: ['chest'] },
	{ id: 'back', label: 'Back', muscles: ['back'] },
	{ id: 'shoulders', label: 'Shoulders', muscles: ['shoulders'] },
	{ id: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
	{ id: 'legs', label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
	{ id: 'core', label: 'Core', muscles: ['core'] }
];

/** Scheduled days, in week order. */
export function trainingDays(program: CatalogProgram): number[] {
	return program.schedule
		.filter((d) => d.items.length > 0)
		.map((d) => d.day)
		.sort((a, b) => a - b);
}

const includes = (text: string, query: string) => normalizeName(text).includes(query);

export function exerciseMatches(exercise: CatalogExercise, query: string): boolean {
	const q = normalizeName(query);
	return !q || [exercise.name, ...(exercise.aliases ?? [])].some((n) => includes(n, q));
}

/** Routines also match on what's in them, so "squat" finds every leg day. */
export function routineMatches(catalog: Catalog, routine: CatalogRoutine, query: string): boolean {
	const q = normalizeName(query);
	if (!q) return true;
	if (includes(routine.name, q) || includes(routine.description, q)) return true;
	return routine.exercises.some((e) => {
		const exercise = catalog.exercise(e.exerciseId);
		return exercise !== null && exerciseMatches(exercise, query);
	});
}

export function programMatches(catalog: Catalog, program: CatalogProgram, query: string): boolean {
	const q = normalizeName(query);
	if (!q) return true;
	if (includes(program.name, q) || includes(program.description, q)) return true;
	return program.schedule
		.flatMap((d) => d.items)
		.some((item) => {
			if (item.type === 'exercise') {
				const exercise = catalog.exercise(item.exerciseId);
				return exercise !== null && exerciseMatches(exercise, query);
			}
			const routine = catalog.routine(item.routineId);
			return routine !== null && includes(routine.name, q);
		});
}
