/**
 * Title and back target for the navbar on detail pages. Set from a page's
 * `$effect`, cleared when that page unmounts.
 */
export const navState = $state<{ title: string; backHref: string }>({ title: '', backHref: '/' });

/** The tab pages' titles; Today's greeting is its own heading. */
export const TAB_TITLES: Record<string, string> = {
	'/history': 'History',
	'/library': 'Library',
	'/discover': 'Discover'
};

/** What a page is called, for the browser title: "Today", "History", a routine's name. */
export function pageTitle(pathname: string): string {
	if (pathname === '/') return 'Today';
	return TAB_TITLES[pathname] ?? navState.title;
}

/** Convenience for detail pages: sets the navbar and restores it on unmount. */
export function setPageNav(title: () => string, backHref: () => string) {
	$effect(() => {
		navState.title = title();
		navState.backHref = backHref();
		return () => {
			navState.title = '';
			navState.backHref = '/';
		};
	});
}
