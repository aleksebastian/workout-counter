import { redirect } from '@sveltejs/kit';

// Train merged into Today. Old links, bookmarks and the installed app's
// muscle memory still land somewhere sensible.
export function load() {
	redirect(308, '/');
}
