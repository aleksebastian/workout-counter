import { describe, it, expect } from 'vitest';
import { datetimeLocal, getNameValidationMsg, newId } from './utils';

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

describe('newId', () => {
	const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

	it('is a v4 UUID, and a fresh one each time', () => {
		expect(newId()).toMatch(UUID_V4);
		expect(newId()).not.toBe(newId());
	});

	it("still makes one where randomUUID isn't there (plain http)", () => {
		// An own property hides the prototype's method; deleting it brings it back.
		Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
		try {
			expect(newId()).toMatch(UUID_V4);
		} finally {
			delete (crypto as { randomUUID?: unknown }).randomUUID;
		}
		expect(typeof crypto.randomUUID).toBe('function');
	});
});
