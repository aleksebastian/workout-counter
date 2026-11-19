import { HAPTIC } from '$lib/haptic';

const DELAY_BEFORE_REPEAT = 400;
const REPEAT_INTERVAL = 100;

/**
 * Press-and-hold to repeat an action, for +/- steppers.
 *
 * `<button use:holdRepeat={() => reps++}>` — fires once immediately, then every
 * 100ms after a 400ms hold, with a haptic tap per fire.
 *
 * A press with no pointer behind it (Enter or Space on the focused button, or
 * a click from assistive tech) fires once through `click`. A tap's own click
 * is skipped, since its pointerdown already fired.
 */
export function holdRepeat(node: HTMLElement, action: () => void) {
	let current = action;
	let delayTimer: ReturnType<typeof setTimeout> | undefined;
	let repeatTimer: ReturnType<typeof setInterval> | undefined;
	/** A pointer press fired and its click hasn't come yet. */
	let pressed = false;

	function fire() {
		current();
		HAPTIC.tap();
	}

	function start(e: PointerEvent) {
		// Ignore secondary buttons so a right-click doesn't start a repeat.
		if (e.button !== 0) return;
		pressed = true;
		fire();
		delayTimer = setTimeout(() => {
			repeatTimer = setInterval(fire, REPEAT_INTERVAL);
		}, DELAY_BEFORE_REPEAT);
	}

	function stop() {
		clearTimeout(delayTimer);
		clearInterval(repeatTimer);
		delayTimer = undefined;
		repeatTimer = undefined;
	}

	function click(e: MouseEvent) {
		// A keyboard click has detail 0 and never follows a pointerdown. Any
		// other click fires only if no pointerdown already did.
		const fromPointer = e.detail !== 0 && pressed;
		pressed = false;
		if (!fromPointer) fire();
	}

	node.addEventListener('pointerdown', start);
	node.addEventListener('pointerup', stop);
	node.addEventListener('pointerleave', stop);
	node.addEventListener('pointercancel', stop);
	node.addEventListener('click', click);

	return {
		update(next: () => void) {
			current = next;
		},
		destroy() {
			stop();
			node.removeEventListener('pointerdown', start);
			node.removeEventListener('pointerup', stop);
			node.removeEventListener('pointerleave', stop);
			node.removeEventListener('pointercancel', stop);
			node.removeEventListener('click', click);
		}
	};
}
