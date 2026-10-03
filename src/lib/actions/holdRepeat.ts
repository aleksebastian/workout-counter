import { HAPTIC } from '$lib/haptic';

const DELAY_BEFORE_REPEAT = 400;
const REPEAT_INTERVAL = 100;

/**
 * Press-and-hold to repeat an action, for +/- steppers.
 *
 * `<button use:holdRepeat={() => reps++}>` — fires once immediately, then every
 * 100ms after a 400ms hold, with a haptic tap per fire.
 */
export function holdRepeat(node: HTMLElement, action: () => void) {
	let current = action;
	let delayTimer: ReturnType<typeof setTimeout> | undefined;
	let repeatTimer: ReturnType<typeof setInterval> | undefined;

	function fire() {
		current();
		HAPTIC.tap();
	}

	function start(e: PointerEvent) {
		// Ignore secondary buttons so a right-click doesn't start a repeat.
		if (e.button !== 0) return;
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

	node.addEventListener('pointerdown', start);
	node.addEventListener('pointerup', stop);
	node.addEventListener('pointerleave', stop);
	node.addEventListener('pointercancel', stop);

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
		}
	};
}
