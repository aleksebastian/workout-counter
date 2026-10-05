import { loadCatalog } from '$lib/catalog';
import type { LayoutLoad } from './$types';

// Loaded here rather than in each page so moving between the list and a detail
// page never re-fetches; `loadCatalog` memoises across navigations too.
export const load: LayoutLoad = async () => ({ catalog: await loadCatalog() });
