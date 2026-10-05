import { createCatalog, type Catalog } from './catalog';

export type { Catalog } from './catalog';
export type * from './types';
export {
	planImport,
	isInLibrary,
	type AliasChoice,
	type ImportPlan,
	type ExerciseMatch,
	type Library
} from './plan';

let pending: Promise<Catalog> | null = null;

/**
 * The only way the app reads the catalog. It is async even though the data is
 * bundled today, so moving it to Firestore later changes this function and
 * nothing that calls it.
 *
 * The dynamic import keeps the catalog out of the main bundle; the service
 * worker precaches every build chunk, so it still works offline.
 */
export function loadCatalog(): Promise<Catalog> {
	pending ??= import('./data')
		.then((m) => createCatalog(m.catalogData))
		.catch((err) => {
			pending = null; // let the next caller retry
			throw err;
		});
	return pending;
}
