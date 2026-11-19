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
 * is skipped, since its pointerdown already fired, whatever its `detail`.
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

	/** A press that won't end in a click (or a key that will) leaves none pending. */
	function forget() {
		pressed = false;
	}

	function cancel() {
		stop();
		forget();
	}

	function click() {
		if (pressed) pressed = false;
		else fire();
	}

	node.addEventListener('pointerdown', start);
	node.addEventListener('pointerup', stop);
	node.addEventListener('pointerleave', stop);
	node.addEventListener('pointercancel', cancel);
	node.addEventListener('keydown', forget);
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
			node.removeEventListener('pointercancel', cancel);
			node.removeEventListener('keydown', forget);
			node.removeEventListener('click', click);
		}
	};
}
