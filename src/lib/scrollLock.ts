/**
 * iOS-safe scroll lock: `overflow: hidden` alone doesn't stop touch-scrolling the
 * page behind an overlay on iOS, so pin the body with position:fixed at its
 * current offset. Returns the unlock, which restores the scroll position.
 */
export function lockBodyScroll(): () => void {
	const scrollY = window.scrollY;
	const style = document.body.style;
	style.position = 'fixed';
	style.top = `-${scrollY}px`;
	style.left = '0';
	style.right = '0';
	style.overflow = 'hidden';

	return () => {
		style.position = '';
		style.top = '';
		style.left = '';
		style.right = '';
		style.overflow = '';
		window.scrollTo(0, scrollY);
	};
}
