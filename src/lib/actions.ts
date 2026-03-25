/** Locks body scroll while a <dialog> is open.
 * Uses position:fixed trick so iOS Safari also respects the lock.
 */
export function scrollLock(node: HTMLDialogElement) {
	let scrollY = 0;

	function lock() {
		scrollY = window.scrollY;
		document.body.style.cssText += `; position: fixed; top: -${scrollY}px; left: 0; right: 0; overflow-y: scroll;`;
	}

	function unlock() {
		document.body.style.position = '';
		document.body.style.top = '';
		document.body.style.left = '';
		document.body.style.right = '';
		document.body.style.overflowY = '';
		window.scrollTo({ top: scrollY, behavior: 'instant' });
	}

	const observer = new MutationObserver(() => {
		if (node.open) lock();
		else unlock();
	});
	observer.observe(node, { attributes: true, attributeFilter: ['open'] });

	return {
		destroy() {
			observer.disconnect();
			if (node.open) unlock();
		}
	};
}
