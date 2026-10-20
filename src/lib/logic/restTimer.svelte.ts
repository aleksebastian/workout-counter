import { add } from 'date-fns';
import { HAPTIC } from '$lib/haptic';
import { session } from '$lib/session.svelte';
import { user } from '$lib/data';
import { durationMs, parseStoredRest, pickRest, type Rest } from '$lib/logic/rest';
import type { Duration } from '$lib/types';

/**
 * The rest countdown, as a module rather than a pile of state in the root
 * layout. Call sites say `restTimer.start({ workoutId })` — previously this was
 * a `document.dispatchEvent(new CustomEvent('startTimer'))` that only the
 * layout listened for, which made the wiring invisible to anyone reading a page.
 */

const STORAGE_KEY = 'workout-counter-rest-timer';
/** Set once the user has answered the "turn on a rest timer?" offer either way. */
const OFFER_ANSWERED_KEY = 'sc-rest-offer-answered';

let display = $state<string | undefined>(undefined);
let remainingMs = $state(0);
let totalMs = $state(0);
/** Where the running duration came from, so the UI can say so. */
let sourceLabel = $state<string | null>(null);
/** Showing the one-time offer to turn the global timer on. */
let offering = $state(false);

let handle: ReturnType<typeof setInterval> | undefined;
let expiresAt: Date | undefined;
let messageId: string | null = null;
/**
 * Bumped whenever the scheduled push stops applying (rest stopped or
 * replaced). A schedule request that comes back after that cancels its own
 * message instead of keeping it — otherwise skipping a rest before the
 * request returned still notified.
 */
let pushGeneration = 0;

function format(ms: number): string {
	const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/** An explicit duration wins; otherwise see `pickRest`. */
function resolve(opts: StartOptions): Rest | null {
	if (opts.duration) return { duration: opts.duration, label: opts.label ?? null };
	return pickRest(session.routine(opts.routineId), session.prefs);
}

function offerAnswered(): boolean {
	try {
		return localStorage.getItem(OFFER_ANSWERED_KEY) === 'true';
	} catch {
		return false;
	}
}

function answerOffer() {
	offering = false;
	try {
		localStorage.setItem(OFFER_ANSWERED_KEY, 'true');
	} catch {
		// Private mode: the offer may come back next session, which is harmless.
	}
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

/** Keeps the running rest, and its push, across a reload. */
function persist() {
	if (!expiresAt) return;
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ expiresAt: expiresAt.getTime(), messageId })
		);
	} catch {
		// Private mode: a reload loses the countdown, which is harmless.
	}
}

function forget() {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Nothing was stored.
	}
}

function clearHandle() {
	if (handle !== undefined) {
		clearInterval(handle);
		handle = undefined;
	}
}

async function schedulePush(expiresAtMs: number) {
	if (!('Notification' in window) || Notification.permission !== 'granted') return;
	const generation = pushGeneration;
	try {
		const res = await fetch('/api/push/schedule', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ expiresAt: expiresAtMs })
		});
		if (!res.ok) return;
		const id: string | null = (await res.json()).messageId ?? null;
		if (!id) return;
		if (generation !== pushGeneration) {
			cancelMessage(id);
			return;
		}
		messageId = id;
		persist();
	} catch (err) {
		console.error('[push] schedule failed:', err);
	}
}

function cancelMessage(id: string) {
	fetch('/api/push/cancel', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ messageId: id })
	}).catch(() => {});
}

function cancelPush() {
	pushGeneration++;
	const id = messageId;
	messageId = null;
	if (id) cancelMessage(id);
}

export type StartOptions = {
	/** Overrides everything else. */
	duration?: Duration;
	/** The routine being trained right now, whose timer wins if it has one. */
	routineId?: string;
	label?: string;
};

export const restTimer = {
	get display() {
		return display;
	},
	/** A countdown is running. */
	get active() {
		return display !== undefined;
	},
	/** Something occupies the bar's slot — a countdown or the offer — for layout to clear. */
	get barVisible() {
		return display !== undefined || this.offering;
	},
	/**
	 * The global timer is off and the user hasn't been asked about it yet. Gone
	 * as soon as it's on, however it got turned on (e.g. via the Preferences link).
	 */
	get offering() {
		return offering && !session.prefs.timerEnabled;
	},
	/** 0–100, drains toward 0. */
	get progress() {
		return totalMs > 0 ? Math.min(100, Math.max(0, (remainingMs / totalMs) * 100)) : 0;
	},
	/** Routine name when a routine's timer is running, otherwise null. */
	get source() {
		return sourceLabel;
	},

	/**
	 * Starts the rest after a recorded set. Returns whether a countdown started,
	 * so callers can tie follow-up nudges (rest-end notifications) to a real one.
	 */
	start(opts: StartOptions = {}): boolean {
		const rest = resolve(opts);
		if (!rest || durationMs(rest.duration) <= 0) {
			// A countdown left over from an earlier set no longer applies.
			restTimer.stop();
			if (!offerAnswered()) offering = true;
			return false;
		}

		const { duration, label } = rest;
		clearHandle();
		cancelPush();
		offering = false;

		totalMs = durationMs(duration);
		sourceLabel = label;
		expiresAt = add(new Date(), { minutes: duration.minutes, seconds: duration.seconds });
		persist();

		remainingMs = totalMs;
		display = format(totalMs);

		schedulePush(expiresAt.getTime());
		handle = setInterval(tick, 1000);
		return true;
	},

	/**
	 * Accepts the offer: turns the global timer on and starts it right away,
	 * since the user has just finished a set.
	 */
	async acceptOffer() {
		answerOffer();
		const prefs = session.prefs;
		restTimer.start({ duration: prefs.timer });
		await user.setPreferences({ ...prefs, timerEnabled: true });
	},

	dismissOffer() {
		answerOffer();
	},

	stop() {
		clearHandle();
		cancelPush();
		forget();
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
		let raw: string | null = null;
		try {
			raw = localStorage.getItem(STORAGE_KEY);
		} catch {
			// Storage unavailable: nothing to restore.
		}
		const stored = parseStoredRest(raw);
		if (stored) {
			const left = stored.expiresAt - Date.now();
			if (left > 0) {
				expiresAt = new Date(stored.expiresAt);
				messageId = stored.messageId;
				// The original total is gone; treat what's left as the full bar so the
				// drain animation stays monotonic rather than jumping.
				totalMs = left;
				remainingMs = left;
				display = format(left);
				handle = setInterval(tick, 1000);
			} else {
				forget();
			}
		} else if (raw) {
			forget();
		}

		return () => {
			clearHandle();
			cancelPush();
		};
	}
};
