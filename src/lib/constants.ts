import type { Preferences } from '$lib/types';

export const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAY_FULL = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday'
] as const;

/** Step used by the weight +/- buttons, in the user's unit. */
export const WEIGHT_STEP = 2.5;

/** The second, coarser weight stepper — about a plate pair's jump. */
export function bigWeightStep(unit: 'lbs' | 'kg') {
	return unit === 'kg' ? 5 : 10;
}

export const TIMER_PRESETS = [
	{ label: '0:30', minutes: 0, seconds: 30 },
	{ label: '1:00', minutes: 1, seconds: 0 },
	{ label: '1:30', minutes: 1, seconds: 30 },
	{ label: '2:00', minutes: 2, seconds: 0 },
	{ label: '2:30', minutes: 2, seconds: 30 },
	{ label: '3:00', minutes: 3, seconds: 0 },
	{ label: '3:30', minutes: 3, seconds: 30 },
	{ label: '4:00', minutes: 4, seconds: 0 },
	{ label: '4:30', minutes: 4, seconds: 30 },
	{ label: '5:00', minutes: 5, seconds: 0 }
];

/**
 * Applied wherever a preference is missing. New accounts get this written to
 * Firestore at username-claim time so nobody has to answer a settings
 * questionnaire before logging their first set.
 */
export const DEFAULT_PREFERENCES: Preferences = {
	timer: { minutes: 1, seconds: 30 },
	// Off until asked: the first set logged without a timer offers to turn it
	// on (see restTimer), at the moment it's actually useful.
	timerEnabled: false,
	theme: 'system',
	weightUnit: 'lbs',
	distanceUnit: 'mi',
	weekStart: 0,
	weeklyGoal: 3,
	streaksEnabled: true
};
