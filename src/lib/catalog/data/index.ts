import type { CatalogData } from '../types';
import { exercises } from './exercises';
import { routines } from './routines';
import { programs } from './programs';

/** Loaded lazily via `loadCatalog`, so it ships as its own chunk. */
export const catalogData: CatalogData = { exercises, routines, programs };
