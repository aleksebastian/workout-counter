import { describe, it, expect } from 'vitest';
import {
	formatDistance,
	formatPace,
	formatSeconds,
	formatSet,
	fromMeters,
	isTimed,
	measureOf,
	summarizeSets,
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

	it('sums up an exercise for the done screen, by its measure', () => {
		const holds = [set({ reps: 1, holdSeconds: 10 }), set({ reps: 1, holdSeconds: 10 })];
		expect(summarizeSets(holds, 'hold', units)).toBe('2 sets · 1 × 10s');
		expect(
			summarizeSets(
				[set({ reps: 5, holdSeconds: 10 }), set({ reps: 3, holdSeconds: 10 })],
				'hold',
				units
			)
		).toBe('2 sets · 8 × 10s');
		expect(
			summarizeSets(
				[set({ reps: 3, holdSeconds: 10 }), set({ reps: 3, holdSeconds: 15 })],
				'hold',
				units
			)
		).toBe('2 sets · 6 × 10–15s');
		expect(summarizeSets([set({ seconds: 1710 }), set({ seconds: 1810 })], 'distance', units)).toBe(
			'2 sets · 58:40 total'
		);
		expect(summarizeSets([set({ seconds: 300 }), set({ seconds: 270 })], 'time', units)).toBe(
			'2 sets · 9:30 total'
		);
		expect(summarizeSets([set({ meters: 5200, seconds: 1710 })], 'distance', units)).toBe(
			'1 set · 5.2 km · 28:30'
		);
		expect(summarizeSets([set({ meters: 5000 }), set({ meters: 4600 })], 'distance', units)).toBe(
			'2 sets · 9.6 km total'
		);
		expect(
			summarizeSets([set({ reps: 10, weight: 20 }), set({ reps: 10, weight: 25 })], 'reps', units)
		).toBe('2 × 10 · top 25 lb');
		expect(summarizeSets([set({ reps: 10 }), set({ reps: 8 })], 'reps', units)).toBe(
			'2 sets · 18 reps'
		);
		expect(summarizeSets([], 'hold', units)).toBe('');
	});

	it('formats long times with hours', () => {
		expect(formatSeconds(45)).toBe('0:45');
		expect(formatSeconds(3725)).toBe('1:02:05');
	});
});
