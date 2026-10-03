import { add } from 'date-fns';
import { HAPTIC } from '$lib/haptic';
import { session } from '$lib/session.svelte';
import type { Duration } from '$lib/types';

/**
 * The rest countdown, as a module rather than a pile of state in the root
 * layout. Call sites say `restTimer.start({ workoutId })` — previously this was
 * a `document.dispatchEvent(new CustomEvent('startTimer'))` that only the
 * layout listened for, which made the wiring invisible to anyone reading a page.
 */

const STORAGE_KEY = 'workout-counter-rest-timer';

let display = $state<string | undefined>(undefined);
let remainingMs = $state(0);
let totalMs = $state(0);
/** Where the running duration came from, so the UI can say so. */
let sourceLabel = $state<string | null>(null);

let handle: ReturnType<typeof setInterval> | undefined;
let expiresAt: Date | undefined;
let qstashMessageId: string | null = null;

function format(ms: number): string {
	const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function toMs(d: Duration): number {
	return (d.minutes * 60 + d.seconds) * 1000;
}

/**
 * Duration precedence: an explicit duration wins, then the timer on the routine
 * this exercise is being trained under, then the user's global preference.
 */
function resolve(opts: StartOptions = {}): { duration: Duration; label: string | null } {
	if (opts.duration) return { duration: opts.duration, label: opts.label ?? null };

	const routine =
		session.routine(opts.routineId) ??
		// Fall back to any routine that contains this exercise and overrides the timer.
		(opts.workoutId
			? (session.routines?.find(
					(r) => r.timer && r.exercises.some((ex) => ex.workoutId === opts.workoutId)
				) ?? null)
			: null);

	if (routine?.timer) return { duration: routine.timer, label: routine.name };
	return { duration: session.prefs.timer, label: null };
}

function tick() {
	if (!expiresAt) return;
	const left = expiresAt.getTime() - Date.now();
	if (left <= 0) {
		display = '0:00';
		remainingMs = 0;
		HAPTIC.timerDone();
		// Let the 0:00 frame land before the bar disappears.
		setTimeout(() => restTimer.stop(), 450);
		return;
	}
	remainingMs = left;
	display = format(left);
}

function clearHandle() {
	if (handle !== undefined) {
		clearInterval(handle);
		handle = undefined;
	}
}

async function schedulePush(expiresAtMs: number) {
	if (!('Notification' in window) || Notification.permission !== 'granted') return;
	try {
		const res = await fetch('/api/push/schedule', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ expiresAt: expiresAtMs })
		});
		if (res.ok) {
			qstashMessageId = (await res.json()).messageId ?? null;
		}
	} catch (err) {
		console.error('[push] schedule failed:', err);
	}
}

function cancelPush() {
	const id = qstashMessageId;
	if (!id) return;
	qstashMessageId = null;
	fetch('/api/push/cancel', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ messageId: id })
	}).catch(() => {});
}

export type StartOptions = {
	/** Overrides everything else. */
	duration?: Duration;
	/** Prefer this routine's timer, if it has one. */
	routineId?: string;
	/** Prefer the timer of a routine containing this exercise, if any. */
	workoutId?: string;
	label?: string;
};

export const restTimer = {
	get display() {
		return display;
	},
	get active() {
		return display !== undefined;
	},
	/** 0–100, drains toward 0. */
	get progress() {
		return totalMs > 0 ? Math.min(100, Math.max(0, (remainingMs / totalMs) * 100)) : 0;
	},
	/** Routine name when a routine's timer is running, otherwise null. */
	get source() {
		return sourceLabel;
	},

	start(opts: StartOptions = {}) {
		const { duration, label } = resolve(opts);
		clearHandle();
		cancelPush();

		totalMs = toMs(duration);
		if (totalMs <= 0) return;

		sourceLabel = label;
		expiresAt = add(new Date(), { minutes: duration.minutes, seconds: duration.seconds });
		localStorage.setItem(STORAGE_KEY, expiresAt.toISOString());

		remainingMs = totalMs;
		display = format(totalMs);

		schedulePush(expiresAt.getTime());
		handle = setInterval(tick, 1000);
	},

	stop() {
		clearHandle();
		cancelPush();
		localStorage.removeItem(STORAGE_KEY);
		expiresAt = undefined;
		display = undefined;
		remainingMs = 0;
		totalMs = 0;
		sourceLabel = null;
	},

	/**
	 * Resumes a countdown that was running when the app was last closed.
	 * Returns a teardown function for the layout's `onMount`.
	 */
	restore() {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = new Date(stored);
			const left = parsed.getTime() - Date.now();
			if (left > 0) {
				expiresAt = parsed;
				// The original total is gone; treat what's left as the full bar so the
				// drain animation stays monotonic rather than jumping.
				totalMs = left;
				remainingMs = left;
				display = format(left);
				handle = setInterval(tick, 1000);
			} else {
				localStorage.removeItem(STORAGE_KEY);
			}
		}

		return () => {
			clearHandle();
			cancelPush();
		};
	}
};
