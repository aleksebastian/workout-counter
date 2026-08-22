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

export const QUICK_REPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 30];

export const QUICK_WEIGHTS_LBS = [
	2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 95,
	100, 115, 135, 155, 185, 225, 275, 315
];

export const QUICK_WEIGHTS_KG = [
	2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110,
	120, 140
];

export function quickWeights(unit: 'lbs' | 'kg') {
	return unit === 'kg' ? QUICK_WEIGHTS_KG : QUICK_WEIGHTS_LBS;
}

/** Step used by the weight +/- buttons, in the user's unit. */
export const WEIGHT_STEP = 2.5;

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
	theme: 'system',
	weightUnit: 'lbs',
	weekStart: 0,
	weeklyGoal: 3,
	streaksEnabled: true
};
