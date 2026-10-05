import { describe, it, expect } from 'vitest';
import { pickRest, resolvePreferences, routineIdFromHref } from './rest';
import { DEFAULT_PREFERENCES } from '$lib/constants';
import type { Routine } from '$lib/types';

const routine = (timer?: Routine['timer']): Routine => ({
	id: 'r1',
	name: 'Leg Day',
	exercises: [],
	timer,
	createdAt: 0
});

describe('resolvePreferences', () => {
	it('starts new accounts with the global timer off but a usable duration', () => {
		const prefs = resolvePreferences(undefined);
		expect(prefs.timerEnabled).toBe(false);
		expect(prefs.timer).toEqual(DEFAULT_PREFERENCES.timer);
	});

	it('keeps an older account with a saved duration on', () => {
		const prefs = resolvePreferences({ timer: { minutes: 2, seconds: 0 } });
		expect(prefs.timerEnabled).toBe(true);
		expect(prefs.timer).toEqual({ minutes: 2, seconds: 0 });
	});

	it('reads a saved 0:00 as off, with a real duration to switch back on to', () => {
		const prefs = resolvePreferences({ timer: { minutes: 0, seconds: 0 } });
		expect(prefs.timerEnabled).toBe(false);
		expect(prefs.timer).toEqual(DEFAULT_PREFERENCES.timer);
	});

	it('honours the explicit flag either way', () => {
		const timer = { minutes: 1, seconds: 0 };
		expect(resolvePreferences({ timer, timerEnabled: false }).timerEnabled).toBe(false);
		expect(resolvePreferences({ timer, timerEnabled: true }).timerEnabled).toBe(true);
	});

	it('never reports a 0:00 timer as on', () => {
		const prefs = resolvePreferences({ timer: { minutes: 0, seconds: 0 }, timerEnabled: true });
		expect(prefs.timerEnabled).toBe(false);
	});

	it('fills a partially stored timer from the defaults', () => {
		const prefs = resolvePreferences({ timer: { minutes: 3 } as never });
		expect(prefs.timer).toEqual({ minutes: 3, seconds: DEFAULT_PREFERENCES.timer.seconds });
	});
});

describe('pickRest', () => {
	const on = { ...DEFAULT_PREFERENCES, timerEnabled: true, timer: { minutes: 1, seconds: 30 } };
	const off = { ...on, timerEnabled: false };

	it("uses the routine's timer while training it, labelled with its name", () => {
		expect(pickRest(routine({ minutes: 2, seconds: 30 }), off)).toEqual({
			duration: { minutes: 2, seconds: 30 },
			label: 'Leg Day'
		});
	});

	it('falls back to the global timer when the routine has none', () => {
		expect(pickRest(routine(), on)).toEqual({ duration: on.timer, label: null });
		expect(pickRest(null, on)).toEqual({ duration: on.timer, label: null });
	});

	it('returns nothing when no timer applies', () => {
		expect(pickRest(routine(), off)).toBeNull();
		expect(pickRest(null, off)).toBeNull();
	});
});

describe('routineIdFromHref', () => {
	it('reads the routine from a ?from= link', () => {
		expect(routineIdFromHref('/routines/abc-123')).toBe('abc-123');
		expect(routineIdFromHref('/routines/abc?x=1')).toBe('abc');
	});

	it('ignores anything else', () => {
		expect(routineIdFromHref('/train')).toBeUndefined();
		expect(routineIdFromHref('/programs/abc')).toBeUndefined();
		expect(routineIdFromHref(null)).toBeUndefined();
	});
});
