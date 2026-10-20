import { describe, expect, it } from 'vitest';
import { canStartSession, FRESH_TOKEN_SECONDS } from './session';

const NOW = 1_800_000_000;

describe('canStartSession', () => {
	it('accepts a freshly issued token from a sign-in days ago', () => {
		const token = { iat: NOW - 10, auth_time: NOW - 10 * 24 * 60 * 60 };
		expect(canStartSession(token, NOW)).toBe(true);
	});

	it('rejects a token issued too long ago', () => {
		expect(canStartSession({ iat: NOW - FRESH_TOKEN_SECONDS - 1 }, NOW)).toBe(false);
	});

	it('tolerates slight clock skew but not a token from the future', () => {
		expect(canStartSession({ iat: NOW + 30 }, NOW)).toBe(true);
		expect(canStartSession({ iat: NOW + 600 }, NOW)).toBe(false);
	});
});
