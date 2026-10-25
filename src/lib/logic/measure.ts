import { counted } from '$lib/utils';
import type { Measure, MeasureTargets, Preferences, Set, Workout } from '$lib/types';

/**
 * How an exercise is measured — reps and weight, time, distance and time, or
 * reps with a hold — and how its sets read. Distances are stored in meters
 * and shown in the user's unit; times are stored in whole seconds.
 */

export type DistanceUnit = Preferences['distanceUnit'];

const METERS: Record<DistanceUnit, number> = { km: 1000, mi: 1609.344 };

/** An exercise with no measure set is reps and weight. */
export const measureOf = (workout: Pick<Workout, 'measure'> | null | undefined): Measure =>
	workout?.measure ?? 'reps';

/** Sets measured by the clock skip the rest timer: the time is the work. */
export const isTimed = (measure: Measure) => measure === 'time' || measure === 'distance';

/** Meters to the user's unit, to two decimals: 5200 → 5.2 (km). */
export function fromMeters(meters: number, unit: DistanceUnit): number {
	return Math.round((meters / METERS[unit]) * 100) / 100;
}

/** The user's unit to whole meters. */
export function toMeters(value: number, unit: DistanceUnit): number {
	return Math.round(value * METERS[unit]);
}

/** "5.2 km", "3.1 mi". */
export function formatDistance(meters: number, unit: DistanceUnit): string {
	return `${fromMeters(meters, unit)} ${unit}`;
}

/** "0:45", "28:30", "1:02:05". */
export function formatSeconds(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = (s % 60).toString().padStart(2, '0');
	return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** A target length in words: "45s", "30 min", or "1:30" when it's neither. */
export function formatTargetSeconds(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	return seconds % 60 === 0 ? `${seconds / 60} min` : formatSeconds(seconds);
}

/**
 * What a set should reach, for the measures that aren't reps: "30 min",
 * "5 km", "5 km in 30 min", "10 × 5s hold". `null` with nothing set.
 */
export function measureTarget(
	entry: MeasureTargets & { maxReps?: number; minReps?: number },
	measure: Measure,
	unit: DistanceUnit
): string | null {
	const { targetSeconds, targetMeters, holdSeconds } = entry;
	if (measure === 'time') return targetSeconds ? formatTargetSeconds(targetSeconds) : null;
	if (measure === 'distance') {
		const far = targetMeters ? formatDistance(targetMeters, unit) : null;
		const long = targetSeconds ? formatTargetSeconds(targetSeconds) : null;
		return far && long ? `${far} in ${long}` : (far ?? long);
	}
	if (measure === 'hold' && holdSeconds) {
		const reps = entry.maxReps ?? entry.minReps;
		return reps ? `${reps} × ${holdSeconds}s hold` : `${holdSeconds}s hold`;
	}
	return null;
}

/** Seconds per km or mile; `null` without both a distance and a time. */
export function paceSeconds(meters: number, seconds: number, unit: DistanceUnit): number | null {
	if (meters <= 0 || seconds <= 0) return null;
	return seconds / (meters / METERS[unit]);
}

/** "5:29 /km"; empty without both a distance and a time. */
export function formatPace(meters: number, seconds: number, unit: DistanceUnit): string {
	const pace = paceSeconds(meters, seconds, unit);
	return pace === null ? '' : `${formatSeconds(Math.round(pace))} /${unit}`;
}

export type Units = { weight: string; distance: DistanceUnit };

/** One set as it reads anywhere: "135 lb × 8", "10 reps", "30:00", "5.2 km · 28:30", "10 × 5s". */
export function formatSet(set: Set, measure: Measure, units: Units): string {
	switch (measure) {
		case 'time':
			return formatSeconds(set.seconds ?? 0);
		case 'distance':
			return [
				set.meters ? formatDistance(set.meters, units.distance) : '',
				set.seconds ? formatSeconds(set.seconds) : ''
			]
				.filter(Boolean)
				.join(' · ');
		case 'hold':
			return `${set.reps} × ${set.holdSeconds ?? 0}s`;
		default:
			return set.weight ? `${set.weight} ${units.weight} × ${set.reps}` : counted(set.reps, 'rep');
	}
}

/** The user's units, with distance following weight until it's chosen. */
export function unitsOf(prefs: Pick<Preferences, 'weightUnit' | 'distanceUnit'>): Units {
	return { weight: prefs.weightUnit === 'kg' ? 'kg' : 'lb', distance: prefs.distanceUnit };
}
