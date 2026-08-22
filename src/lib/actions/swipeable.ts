import { HAPTIC } from '$lib/haptic';

const ACTION_THRESHOLD = 80;
const REVEAL_THRESHOLD = 40;
const OVERSHOOT = 20;
/** Movement needed before we decide this is a swipe and not a page scroll. */
const DIRECTION_LOCK = 5;
const HAPTIC_THROTTLE_MS = 100;

export type SwipeOptions = {
	/** Dragging the row left past the threshold — typically destructive. */
	onSwipeLeft?: () => void;
	/** Dragging the row right past the threshold. */
	onSwipeRight?: () => void;
	disabled?: boolean;
};

/**
 * Swipe a row sideways to reveal actions behind it.
 *
 * Apply to the sliding element; put the action panels behind it as absolutely
 * positioned siblings. Direction is locked on first movement so a vertical
 * scroll never drags the row, which is the part that's easy to get wrong (and
 * which the two hand-rolled copies of this did differently).
 */
export function swipeable(node: HTMLElement, options: SwipeOptions = {}) {
	let opts = options;
	let startX = 0;
	let startY = 0;
	let offset = 0;
	let axis: 'horizontal' | 'vertical' | null = null;
	let lastHaptic = 0;
	/** Set when a swipe fires an action, so the trailing click is swallowed. */
	let suppressNextClick = false;

	function render(px: number, animate: boolean) {
		node.style.transition = animate ? 'transform 0.2s ease' : 'none';
		node.style.transform = `translateX(${px}px)`;
	}

	function onTouchStart(e: TouchEvent) {
		if (opts.disabled) return;
		startX = e.touches[0].clientX;
		startY = e.touches[0].clientY;
		offset = 0;
		axis = null;
	}

	function onTouchMove(e: TouchEvent) {
		if (opts.disabled) return;
		const dx = e.touches[0].clientX - startX;
		const dy = e.touches[0].clientY - startY;

		if (axis === null) {
			if (Math.abs(dx) > DIRECTION_LOCK || Math.abs(dy) > DIRECTION_LOCK) {
				axis = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
			}
			return;
		}
		if (axis !== 'horizontal') return;

		// Only travel in directions that actually have an action behind them.
		const allowed = dx < 0 ? !!opts.onSwipeLeft : !!opts.onSwipeRight;
		if (!allowed) return;

		const max = ACTION_THRESHOLD + OVERSHOOT;
		offset = Math.max(-max, Math.min(max, dx));
		render(offset, false);

		if (Math.abs(offset) >= REVEAL_THRESHOLD && Date.now() - lastHaptic > HAPTIC_THROTTLE_MS) {
			HAPTIC.tap();
			lastHaptic = Date.now();
		}
	}

	function onTouchEnd() {
		if (opts.disabled) return;
		const settled = offset;
		offset = 0;
		axis = null;
		render(0, true);

		if (settled <= -ACTION_THRESHOLD) {
			suppressNextClick = true;
			opts.onSwipeLeft?.();
		} else if (settled >= ACTION_THRESHOLD) {
			suppressNextClick = true;
			opts.onSwipeRight?.();
		}
	}

	// Touch devices synthesise a click after touchend. Without this, swiping a
	// row to delete it would also open that row's editor behind the dialog.
	function onClick(e: MouseEvent) {
		if (!suppressNextClick) return;
		suppressNextClick = false;
		e.preventDefault();
		e.stopPropagation();
	}

	node.addEventListener('touchstart', onTouchStart, { passive: true });
	node.addEventListener('touchmove', onTouchMove, { passive: true });
	node.addEventListener('touchend', onTouchEnd);
	node.addEventListener('touchcancel', onTouchEnd);
	node.addEventListener('click', onClick, true);

	return {
		update(next: SwipeOptions) {
			opts = next;
			if (next.disabled) render(0, false);
		},
		destroy() {
			node.removeEventListener('touchstart', onTouchStart);
			node.removeEventListener('touchmove', onTouchMove);
			node.removeEventListener('touchend', onTouchEnd);
			node.removeEventListener('touchcancel', onTouchEnd);
			node.removeEventListener('click', onClick, true);
		}
	};
}
