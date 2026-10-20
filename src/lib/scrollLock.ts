// Overlays can stack (a sheet over the account screen), so the body is pinned
// once, by the first lock, and released by whichever lock is released last —
// in whatever order they close.
let depth = 0;
let pinnedScrollY = 0;
let restoreOnRelease = true;

/**
 * iOS-safe scroll lock: `overflow: hidden` alone doesn't stop touch-scrolling the
 * page behind an overlay on iOS, so pin the body with position:fixed at its
 * current offset. Returns the unlock, which restores the scroll position
 * unless told not to (when a navigation has replaced the page meanwhile).
 */
export function lockBodyScroll(): (restoreScroll?: boolean) => void {
	const style = document.body.style;
	if (depth++ === 0) {
		pinnedScrollY = window.scrollY;
		restoreOnRelease = true;
		// Where scrollbars take up space (desktop), keep one showing, or the page
		// widens by its width and everything behind the overlay jumps sideways.
		const hasScrollbar = window.innerWidth > document.documentElement.clientWidth;
		style.position = 'fixed';
		style.top = `-${pinnedScrollY}px`;
		style.left = '0';
		style.right = '0';
		style.overflowY = hasScrollbar ? 'scroll' : 'hidden';
	}

	let released = false;
	return (restoreScroll = true) => {
		if (released) return;
		released = true;
		// Any overlay that handed off to another page vetoes the restore.
		restoreOnRelease &&= restoreScroll;
		if (--depth > 0) return;
		style.position = '';
		style.top = '';
		style.left = '';
		style.right = '';
		style.overflowY = '';
		if (restoreOnRelease) window.scrollTo(0, pinnedScrollY);
	};
}
