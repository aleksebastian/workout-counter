/** Locks body scroll while a <dialog> is open. */
export function scrollLock(node: HTMLDialogElement) {
	const observer = new MutationObserver(() => {
		document.body.style.overflow = node.open ? 'hidden' : '';
	});
	observer.observe(node, { attributes: true, attributeFilter: ['open'] });
	return {
		destroy() {
			observer.disconnect();
			document.body.style.overflow = '';
		}
	};
}
