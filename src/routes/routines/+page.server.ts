import { redirect } from '@sveltejs/kit';

/** Routines are a Library segment now — keep old links and bookmarks working. */
export const load = () => {
	throw redirect(308, '/library?tab=routines');
};
