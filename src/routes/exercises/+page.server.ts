import { redirect } from '@sveltejs/kit';

/** Exercises are a Library segment now — keep old links and bookmarks working. */
export const load = () => {
	throw redirect(308, '/library?tab=exercises');
};
