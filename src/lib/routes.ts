/**
 * Route helpers for the tab shell: Today, History, Library, Discover.
 *
 * Today is where you train: the workout to do now, and every way to start
 * one. It replaced two tabs, Home and Train, that both launched the same
 * workouts. History is what you've done. Library holds your exercises,
 * routines and programs as segments of one tab. Discover is the
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
export const TAB_ROUTES = new Set(['/', '/history', '/library', '/discover']);

/** One past workout in History. */
export function historyItemHref(sessionId: string): string {
	return `/history/${sessionId}`;
}

export function libraryHref(tab: LibraryTab): string {
	return `/library?tab=${tab}`;
}

/** Library's routines with the "New routine" sheet already open. */
export function newRoutineHref(): string {
	return `${libraryHref('routines')}&new=1`;
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

/** The guided session screen, which runs full-screen without the tab chrome. */
export function isRunPath(pathname: string): boolean {
	return pathname.startsWith('/train/run');
}

/**
 * For a workout that ended earlier today: `resume` picks it back up and
 * `fresh` starts a new one, for the cards that show both. With neither, the
 * session screen asks.
 */
type RunOptions = { fresh?: boolean; resume?: boolean };

const freshParam = (opts?: RunOptions) =>
	opts?.resume ? '&resume=1' : opts?.fresh ? '&fresh=1' : '';

/** Guided session for one day of a program. */
export function runProgramHref(
	programId: string,
	day: number,
	sessionId: string,
	opts?: RunOptions
): string {
	return `/train/run?program=${programId}&day=${day}&session=${sessionId}${freshParam(opts)}`;
}

/** Guided session for a routine, start to finish. */
export function runRoutineHref(routineId: string, opts?: RunOptions): string {
	return `/train/run?routine=${routineId}${freshParam(opts)}`;
}
