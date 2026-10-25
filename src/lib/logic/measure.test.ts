import { describe, it, expect } from 'vitest';
import {
	formatDistance,
	formatPace,
	formatSeconds,
	formatSet,
	fromMeters,
	isTimed,
	measureOf,
	toMeters
} from './measure';
import type { Set } from '$lib/types';

const units = { weight: 'lb', distance: 'km' } as const;
const set = (fields: Partial<Set>): Set => ({
	id: 's',
	date: '2026-10-24T08:00:00Z',
	reps: 0,
	...fields
});

describe('measures', () => {
	it('treats an exercise with no measure as reps and weight', () => {
		expect(measureOf({})).toBe('reps');
		expect(measureOf(null)).toBe('reps');
		expect(measureOf({ measure: 'hold' })).toBe('hold');
	});

	it('times only time and distance sets', () => {
		expect(['reps', 'time', 'distance', 'hold'].map((m) => isTimed(m as never))).toEqual([
			false,
			true,
			true,
			false
		]);
	});
});

describe('distance', () => {
	it('stores meters and shows the user’s unit', () => {
		expect(toMeters(5.2, 'km')).toBe(5200);
		expect(toMeters(3.1, 'mi')).toBe(4989);
		expect(fromMeters(5200, 'km')).toBe(5.2);
		expect(fromMeters(4989, 'mi')).toBe(3.1);
		expect(formatDistance(5250, 'km')).toBe('5.25 km');
	});

	it('works out pace per unit', () => {
		expect(formatPace(5200, 28 * 60 + 30, 'km')).toBe('5:29 /km');
		expect(formatPace(0, 600, 'km')).toBe('');
		expect(formatPace(5000, 0, 'km')).toBe('');
	});
});

describe('formatSet', () => {
	it('reads each measure its own way', () => {
		expect(formatSet(set({ reps: 8, weight: 135 }), 'reps', units)).toBe('135 lb × 8');
		expect(formatSet(set({ reps: 10 }), 'reps', units)).toBe('10 reps');
		expect(formatSet(set({ seconds: 1800 }), 'time', units)).toBe('30:00');
		expect(formatSet(set({ meters: 5200, seconds: 1710 }), 'distance', units)).toBe(
			'5.2 km · 28:30'
		);
		expect(formatSet(set({ reps: 10, holdSeconds: 5 }), 'hold', units)).toBe('10 × 5s');
	});

	it('formats long times with hours', () => {
		expect(formatSeconds(45)).toBe('0:45');
		expect(formatSeconds(3725)).toBe('1:02:05');
	});
});
