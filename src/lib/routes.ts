/**
 * Route helpers for the three-tab shell.
 *
 * The app used to have four tabs — Home, Exercises, Routines, Programs — which
 * put three configuration surfaces at the same level as the thing you actually
 * open the app to do. Exercises/Routines/Programs are now segments of one
 * Library tab, and Train is the guided-session entry point.
 */

export type LibraryTab = 'exercises' | 'routines' | 'programs';

export const LIBRARY_TABS: { id: LibraryTab; label: string }[] = [
	{ id: 'exercises', label: 'Exercises' },
	{ id: 'routines', label: 'Routines' },
	{ id: 'programs', label: 'Programs' }
];

/** Route ids that are top-level tabs — used to suppress page view transitions. */
export const TAB_ROUTES = new Set(['/', '/train', '/library']);

export function libraryHref(tab: LibraryTab): string {
	return `/library?tab=${tab}`;
}

export function isLibraryTab(value: string | null | undefined): value is LibraryTab {
	return value === 'exercises' || value === 'routines' || value === 'programs';
}

/** Guided session for one day of a program. */
export function runProgramHref(programId: string, day: number): string {
	return `/train/run?program=${programId}&day=${day}`;
}

/** Guided session for a routine, start to finish. */
export function runRoutineHref(routineId: string): string {
	return `/train/run?routine=${routineId}`;
}
