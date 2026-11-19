/**
 * The part of the screen the keyboard leaves visible, while it's up. iOS
 * doesn't shrink the layout for the keyboard, and only scrolls a focused
 * field into view when it can find one — the note field is focused while
 * still zero-width, so the keyboard simply covered it. Fitting the column
 * to the visible area keeps the footer on top of the keyboard, with the
 * set list giving up the room.
 *
 * Call during component setup. `column` is the logging column: only its own
 * fields count as typing into the screen.
 */
export function keyboardView(column: () => HTMLElement | undefined) {
	let view = $state<{ top: number; height: number } | null>(null);

	$effect(() => {
		const vv = window.visualViewport;
		// A touch screen shows a keyboard for any focused text field; a desktop
		// browser shows none, so its layout is left alone.
		if (!vv || !matchMedia('(pointer: coarse)').matches) return;
		// A field in this column has focus *and* the visible area has shrunk
		// from its full height. Focus alone misfires with a hardware keyboard
		// or a field in a sheet; height alone missed the number pad, which
		// shrinks innerHeight along with the visual viewport.
		let fullHeight = vv.height;
		const update = () => {
			const el = document.activeElement;
			const typing =
				(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
				!!column()?.contains(el);
			if (!typing) fullHeight = Math.max(fullHeight, vv.height);
			view =
				typing && vv.height < fullHeight - 120 ? { top: vv.offsetTop, height: vv.height } : null;
		};
		// Moving between fields with the keyboard's arrows blurs one a moment
		// before focusing the next; checking after that keeps the layout still.
		const afterBlur = () => setTimeout(update);
		update();
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		document.addEventListener('focusin', update);
		document.addEventListener('focusout', afterBlur);
		return () => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
			document.removeEventListener('focusin', update);
			document.removeEventListener('focusout', afterBlur);
		};
	});

	return {
		/** The visible area while the keyboard is up over a field in the column, else `null`. */
		get current() {
			return view;
		}
	};
}
