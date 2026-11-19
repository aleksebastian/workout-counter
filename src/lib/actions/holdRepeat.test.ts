import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdRepeat } from './holdRepeat';

vi.mock('$lib/haptic', () => ({ HAPTIC: { tap: vi.fn() } }));

/** Node has no PointerEvent or MouseEvent, so events carry just what's read. */
function event(type: string, fields: Record<string, number> = {}) {
	return Object.assign(new Event(type), fields);
}

describe('holdRepeat', () => {
	let node: EventTarget;
	let count: number;
	let action: ReturnType<typeof holdRepeat>;

	beforeEach(() => {
		vi.useFakeTimers();
		node = new EventTarget();
		count = 0;
		action = holdRepeat(node as HTMLElement, () => count++);
	});

	afterEach(() => {
		action.destroy();
		vi.useRealTimers();
	});

	it('fires once for a tap, not again for its click', () => {
		node.dispatchEvent(event('pointerdown', { button: 0 }));
		node.dispatchEvent(event('pointerup'));
		node.dispatchEvent(event('click', { detail: 1 }));
		expect(count).toBe(1);
	});

	it('fires once for a keyboard click', () => {
		node.dispatchEvent(event('keydown'));
		node.dispatchEvent(event('click', { detail: 0 }));
		expect(count).toBe(1);
	});

	it('fires once when a press is followed by a click with no detail', () => {
		node.dispatchEvent(event('pointerdown', { button: 0 }));
		node.dispatchEvent(event('pointerup'));
		node.dispatchEvent(event('click', { detail: 0 }));
		expect(count).toBe(1);
	});

	it('does not swallow the next activation after a cancelled press', () => {
		node.dispatchEvent(event('pointerdown', { button: 0 }));
		node.dispatchEvent(event('pointercancel'));
		node.dispatchEvent(event('click', { detail: 1 }));
		expect(count).toBe(2);
	});

	it('does not swallow a key press after a press dragged off the button', () => {
		node.dispatchEvent(event('pointerdown', { button: 0 }));
		node.dispatchEvent(event('pointerleave'));
		node.dispatchEvent(event('keydown'));
		node.dispatchEvent(event('click', { detail: 0 }));
		expect(count).toBe(2);
	});

	it('fires for a click with no pointer press before it', () => {
		node.dispatchEvent(event('click', { detail: 1 }));
		expect(count).toBe(1);
	});

	it('repeats while held, and the click after it adds nothing', () => {
		node.dispatchEvent(event('pointerdown', { button: 0 }));
		vi.advanceTimersByTime(400 + 3 * 100);
		node.dispatchEvent(event('pointerup'));
		node.dispatchEvent(event('click', { detail: 1 }));
		expect(count).toBe(4);
	});

	it('ignores secondary buttons', () => {
		node.dispatchEvent(event('pointerdown', { button: 2 }));
		node.dispatchEvent(event('pointerup'));
		expect(count).toBe(0);
	});

	it('stops listening once destroyed', () => {
		action.destroy();
		node.dispatchEvent(event('click', { detail: 0 }));
		node.dispatchEvent(event('pointerdown', { button: 0 }));
		expect(count).toBe(0);
	});
});
