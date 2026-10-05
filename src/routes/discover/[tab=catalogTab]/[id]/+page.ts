import { error } from '@sveltejs/kit';
import type { CatalogKind } from '$lib/catalog';
import type { DiscoverTab } from '$lib/routes';
import type { PageLoad } from './$types';

const KIND: Record<DiscoverTab, CatalogKind> = {
	exercises: 'exercise',
	routines: 'routine',
	programs: 'program'
};

export const load: PageLoad = async ({ params, parent }) => {
	const { catalog } = await parent();
	const tab = params.tab as DiscoverTab;
	const kind = KIND[tab];
	// An id that has since left the catalog (an old shared link) is a real 404,
	// not a broken page.
	if (!catalog.bundle(kind, params.id)) error(404, 'Not found');
	return { tab, kind, id: params.id };
};
