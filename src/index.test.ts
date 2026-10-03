import { describe, it, expect } from 'vitest';
import { getRequiredOnboardingRoute } from './lib/logic/onboarding';

describe('onboarding route guard', () => {
	it('redirects signed-in users without a profile document to username setup', () => {
		expect(getRequiredOnboardingRoute('/', null)).toBe('/login/username');
		expect(getRequiredOnboardingRoute('/preferences', null)).toBe('/login/username');
	});

	it('redirects users without a username to username setup', () => {
		expect(getRequiredOnboardingRoute('/', { photoURL: 'x' })).toBe('/login/username');
		expect(getRequiredOnboardingRoute('/app', { photoURL: 'x' })).toBe('/login/username');
	});

	it('redirects users without preferences to the preferences page', () => {
		expect(getRequiredOnboardingRoute('/', { username: 'coach', photoURL: 'x' })).toBe('/preferences');
		expect(getRequiredOnboardingRoute('/exercises', { username: 'coach', photoURL: 'x' })).toBe(
			'/preferences'
		);
	});

	it('allows fully onboarded users to use the app', () => {
		expect(
			getRequiredOnboardingRoute('/exercises', {
				username: 'coach',
				photoURL: 'x',
				preferences: { timer: { minutes: 1, seconds: 30 } }
			})
		).toBeNull();
	});
});
