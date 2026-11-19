import { describe, it, expect } from 'vitest';
import { datetimeLocal, getNameValidationMsg } from './utils';

describe('getNameValidationMsg', () => {
	const existing = [{ name: 'Bench Press' }];

	it('requires a name, even before the list has loaded', () => {
		expect(getNameValidationMsg('Workout', '   ', existing)).toBe('Workout name missing');
		expect(getNameValidationMsg('Workout', '', undefined)).toBe('Workout name missing');
		expect(getNameValidationMsg('Routine', '', null)).toBe('Routine name missing');
	});

	it('rejects a name already taken, ignoring case and surrounding space', () => {
		expect(getNameValidationMsg('Program', '  bench press ', existing)).toBe(
			'Program already exists'
		);
	});

	it('accepts a new name', () => {
		expect(getNameValidationMsg('Workout', 'Squat', existing)).toBeUndefined();
		expect(getNameValidationMsg('Workout', 'Squat', undefined)).toBeUndefined();
	});
});

describe('datetimeLocal', () => {
	it('gives local time to the minute, as a datetime-local input wants', () => {
		const d = new Date(2026, 0, 5, 7, 3, 59);
		expect(datetimeLocal(d)).toBe('2026-01-05T07:03');
		expect(datetimeLocal(d.toISOString())).toBe('2026-01-05T07:03');
	});
});
