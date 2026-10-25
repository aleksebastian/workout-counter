import { DEFAULT_PREFERENCES } from '$lib/constants';
import type { Duration, Preferences, Routine } from '$lib/types';

/**
 * Which rest applies after a set, and how stored preferences are read.
 * Kept out of the timer module so the rules can be tested without a session.
 */

export function durationMs(d: Duration): number {
	return (d.minutes * 60 + d.seconds) * 1000;
}

export function formatDuration(d: Duration): string {
	return `${d.minutes}:${d.seconds < 10 ? '0' : ''}${d.seconds}`;
}

/**
 * Stored preferences with defaults applied.
 *
 * The global timer used to have no on/off switch — 0:00 was the only way to
 * turn it off, and clearing the inputs could save that by accident. Now it is
 * an explicit `timerEnabled` flag next to a duration that is always usable, so
 * switching the timer back on restores a real value instead of 0:00.
 *
 * Accounts saved before the flag existed keep the behaviour they had: a stored
 * non-zero duration means on, a stored 0:00 means off. Accounts with no stored
 * timer at all get the default, which is off — the first set offers it instead.
 */
export function resolvePreferences(stored: Partial<Preferences> | undefined): Preferences {
	const timer = { ...DEFAULT_PREFERENCES.timer, ...stored?.timer };
	const usable = durationMs(timer) > 0;
	const enabled =
		stored?.timerEnabled ?? (stored?.timer ? usable : DEFAULT_PREFERENCES.timerEnabled);

	const weightUnit = stored?.weightUnit ?? DEFAULT_PREFERENCES.weightUnit;
	return {
		...DEFAULT_PREFERENCES,
		...stored,
		timer: usable ? timer : DEFAULT_PREFERENCES.timer,
		timerEnabled: enabled && usable,
		distanceUnit: stored?.distanceUnit ?? (weightUnit === 'kg' ? 'km' : 'mi')
	};
}

export type Rest = { duration: Duration; label: string | null };

/**
 * A routine's own timer wins while you're training that routine; otherwise the
 * global timer, if it's on. `null` means no rest timer applies.
 *
 * The routine must be the one actually being trained. This used to fall back
 * to *any* routine containing the exercise, so once catalog routines (which all
 * carry timers) were added, the global setting was effectively ignored.
 */
export function pickRest(routine: Routine | null, prefs: Preferences): Rest | null {
	if (routine?.timer && durationMs(routine.timer) > 0) {
		return { duration: routine.timer, label: routine.name };
	}
	return prefs.timerEnabled ? { duration: prefs.timer, label: null } : null;
}

/** `/routines/{id}` links carry routine context onto an exercise page via `?from=`. */
export function routineIdFromHref(href: string | null | undefined): string | undefined {
	return href?.match(/^\/routines\/([^/?#]+)/)?.[1];
}

/** A running rest as kept in localStorage, so it survives a reload. */
export type StoredRest = { expiresAt: number; restId: string | null };

/**
 * Reads a stored rest back. Older builds stored just the expiry as an ISO
 * string; anything unreadable is `null`, which restores nothing.
 */
export function parseStoredRest(raw: string | null): StoredRest | null {
	if (!raw) return null;
	let value: unknown = raw;
	try {
		value = JSON.parse(raw);
	} catch {
		// Not JSON: the old bare ISO string.
	}
	if (typeof value === 'string') {
		const expiresAt = new Date(value).getTime();
		return Number.isFinite(expiresAt) ? { expiresAt, restId: null } : null;
	}
	const stored = value as Partial<StoredRest> | null;
	if (typeof stored?.expiresAt !== 'number' || !Number.isFinite(stored.expiresAt)) return null;
	return {
		expiresAt: stored.expiresAt,
		restId: typeof stored.restId === 'string' && stored.restId ? stored.restId : null
	};
}
