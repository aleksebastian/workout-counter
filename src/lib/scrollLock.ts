/**
 * iOS-safe scroll lock: `overflow: hidden` alone doesn't stop touch-scrolling the
 * page behind an overlay on iOS, so pin the body with position:fixed at its
 * current offset. Returns the unlock, which restores the scroll position
 * unless told not to (when a navigation has replaced the page meanwhile).
 */
export function lockBodyScroll(): (restoreScroll?: boolean) => void {
	const scrollY = window.scrollY;
	const style = document.body.style;
	style.position = 'fixed';
	style.top = `-${scrollY}px`;
	style.left = '0';
	style.right = '0';
	style.overflow = 'hidden';

	return (restoreScroll = true) => {
		style.position = '';
		style.top = '';
		style.left = '';
		style.right = '';
		style.overflow = '';
		if (restoreScroll) window.scrollTo(0, scrollY);
	};
}
