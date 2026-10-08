import { page } from '$app/state';
import { replaceState } from '$app/navigation';

/**
 * Last tab chosen per page, for this app session. A link without `?tab=`
 * (the bottom nav) reopens it rather than resetting to the first tab.
 */
const lastTab = new Map<string, string>();

/**
 * Selected segment for a tabbed page, mirrored into `?tab=` so a reload or a
 * shared link reopens the same one. Shared by Library and Discover.
 *
 * The selection is local state, not a derivation of `page.url`: shallow
 * routing updates the address bar and `page.state` but deliberately leaves
 * `page.url` pinned to the route's own URL, so deriving from it meant the tab
 * could never change.
 *
 * Call during component init (it registers an effect).
 */
export function urlTab<T extends string>(
	isTab: (v: string | null) => v is T,
	fallback: T,
	/** Remembers the choice under this key for the next visit without `?tab=`. */
	rememberAs?: string
) {
	const fromUrl = page.url.searchParams.get('tab');
	const remembered = rememberAs ? (lastTab.get(rememberAs) ?? null) : null;
	let tab = $state<T>(isTab(fromUrl) ? fromUrl : isTab(remembered) ? remembered : fallback);

	// Re-seed only on a real navigation in with an explicit tab — an old
	// /routines link, a bookmark, or a redirect.
	//
	// The href guard matters: replaceState re-publishes a cloned page object, so
	// without it this effect would re-run after every click and reset the tab
	// from the stale URL, which is the original bug wearing a different hat.
	let seededFrom = '';
	$effect(() => {
		const href = page.url.href;
		if (href === seededFrom) return;
		seededFrom = href;
		const value = page.url.searchParams.get('tab');
		if (isTab(value)) {
			tab = value;
			if (rememberAs) lastTab.set(rememberAs, value);
		}
	});

	return {
		get current() {
			return tab;
		},
		select(next: T) {
			tab = next;
			if (rememberAs) lastTab.set(rememberAs, next);
			// replaceState keeps segments out of history, so Back leaves the page
			// rather than walking back through them.
			const url = new URL(page.url);
			url.searchParams.set('tab', next);
			replaceState(url, page.state);
		}
	};
}
