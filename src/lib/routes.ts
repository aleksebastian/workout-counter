/**
 * Route helpers for the tab shell: Home, Train, Library, Discover.
 *
 * The app used to have four tabs — Home, Exercises, Routines, Programs — which
 * put three configuration surfaces at the same level as the thing you actually
 * open the app to do. Exercises/Routines/Programs are now segments of one
 * Library tab, and Train is the guided-session entry point. Discover is the
 * outward-facing tab: ready-made items to add to your Library today, and the
 * home for shared content later.
 */

export type LibraryTab = 'exercises' | 'routines' | 'programs';

export const LIBRARY_TABS: { id: LibraryTab; label: string }[] = [
	{ id: 'exercises', label: 'Exercises' },
	{ id: 'routines', label: 'Routines' },
	{ id: 'programs', label: 'Programs' }
];

/** Route ids that are top-level tabs — used to suppress page view transitions. */
export const TAB_ROUTES = new Set(['/', '/train', '/library', '/discover']);

export function libraryHref(tab: LibraryTab): string {
	return `/library?tab=${tab}`;
}

export function isLibraryTab(value: string | null | undefined): value is LibraryTab {
	return value === 'exercises' || value === 'routines' || value === 'programs';
}

/** Discover mirrors the Library's segments, so the two read as one model. */
export type DiscoverTab = LibraryTab;
export const DISCOVER_TABS = LIBRARY_TABS;
export const isDiscoverTab = isLibraryTab;

export function discoverHref(tab: DiscoverTab): string {
	return `/discover?tab=${tab}`;
}

/** Detail page for a catalog item; `tab` doubles as the URL segment. */
export function discoverItemHref(tab: DiscoverTab, id: string): string {
	return `/discover/${tab}/${id}`;
}

/** Where a library item lives, by kind. */
export function libraryItemHref(kind: 'exercise' | 'routine' | 'program', id: string): string {
	if (kind === 'exercise') return `/workout/${id}`;
	return kind === 'routine' ? `/routines/${id}` : `/programs/${id}`;
}

/** Guided session for one day of a program. */
export function runProgramHref(programId: string, day: number): string {
	return `/train/run?program=${programId}&day=${day}`;
}

/** Guided session for a routine, start to finish. */
export function runRoutineHref(routineId: string): string {
	return `/train/run?routine=${routineId}`;
}
