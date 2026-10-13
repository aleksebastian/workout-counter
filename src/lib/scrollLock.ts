// Overlays can stack (a sheet over the account screen), so only the outermost
// lock pins the body. An inner lock that pinned it again would read the
// already-pinned scrollY of 0 and, on unlock, release the outer overlay's lock.
let depth = 0;

/**
 * iOS-safe scroll lock: `overflow: hidden` alone doesn't stop touch-scrolling the
 * page behind an overlay on iOS, so pin the body with position:fixed at its
 * current offset. Returns the unlock, which restores the scroll position
 * unless told not to (when a navigation has replaced the page meanwhile).
 */
export function lockBodyScroll(): (restoreScroll?: boolean) => void {
	let released = false;
	if (depth++ > 0) {
		return () => {
			if (released) return;
			released = true;
			depth--;
		};
	}

	const scrollY = window.scrollY;
	const style = document.body.style;
	style.position = 'fixed';
	style.top = `-${scrollY}px`;
	style.left = '0';
	style.right = '0';
	style.overflow = 'hidden';

	return (restoreScroll = true) => {
		if (released) return;
		released = true;
		depth--;
		style.position = '';
		style.top = '';
		style.left = '';
		style.right = '';
		style.overflow = '';
		if (restoreScroll) window.scrollTo(0, scrollY);
	};
}
