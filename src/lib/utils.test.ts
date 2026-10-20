import { describe, it, expect } from 'vitest';
import { getNameValidationMsg } from './utils';

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
