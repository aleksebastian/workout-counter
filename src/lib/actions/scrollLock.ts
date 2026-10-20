import { lockBodyScroll } from '$lib/scrollLock';

/**
 * Locks body scroll while a <dialog> is open. Goes through `lockBodyScroll`,
 * like the sheets, so a dialog over a sheet shares one lock instead of
 * pinning the page twice and releasing it while the sheet is still up.
 */
export function dialogScrollLock(node: HTMLDialogElement) {
	let unlock: (() => void) | null = null;

	function sync() {
		if (node.open && !unlock) {
			unlock = lockBodyScroll();
		} else if (!node.open && unlock) {
			unlock();
			unlock = null;
		}
	}

	const observer = new MutationObserver(sync);
	observer.observe(node, { attributes: true, attributeFilter: ['open'] });
	sync();

	return {
		destroy() {
			observer.disconnect();
			unlock?.();
		}
	};
}
