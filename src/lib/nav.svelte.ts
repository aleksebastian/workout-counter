/**
 * Title and back target for the navbar on detail pages. Set from a page's
 * `$effect`, cleared when that page unmounts.
 */
export const navState = $state<{ title: string; backHref: string }>({ title: '', backHref: '/' });

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
