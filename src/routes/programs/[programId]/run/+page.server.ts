import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** The runner moved to /train/run, where it also handles standalone routines. */
export const load = (({ params, url }) => {
	const day = url.searchParams.get('day') ?? String(new Date().getDay());
	throw redirect(308, `/train/run?program=${params.programId}&day=${day}`);
}) satisfies PageServerLoad;
