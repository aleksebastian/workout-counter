import { describe, it, expect } from 'vitest';
import { getPostLoginDestination, getRequiredOnboardingRoute } from './lib/logic/onboarding';

describe('onboarding route guard', () => {
	it('redirects signed-in users without a profile document to username setup', () => {
		expect(getRequiredOnboardingRoute('/', null)).toBe('/login/username');
		expect(getRequiredOnboardingRoute('/preferences', null)).toBe('/login/username');
	});

	it('redirects users without a username to username setup', () => {
		expect(getRequiredOnboardingRoute('/', { photoURL: 'x' })).toBe('/login/username');
		expect(getRequiredOnboardingRoute('/app', { photoURL: 'x' })).toBe('/login/username');
	});

	it('lets users without a username stay inside the login flow', () => {
		expect(getRequiredOnboardingRoute('/login', null)).toBeNull();
		expect(getRequiredOnboardingRoute('/login/username', { photoURL: 'x' })).toBeNull();
	});

	it('does not gate on preferences — defaults are seeded at username claim', () => {
		expect(getRequiredOnboardingRoute('/', { username: 'coach', photoURL: 'x' })).toBeNull();
		expect(getRequiredOnboardingRoute('/library', { username: 'coach', photoURL: 'x' })).toBeNull();
	});

	it('pushes onboarded users out of the login flow', () => {
		expect(getRequiredOnboardingRoute('/login', { username: 'coach', photoURL: 'x' })).toBe('/');
	});
});

describe('post-login destination', () => {
	it('sends brand-new accounts to username setup', () => {
		expect(getPostLoginDestination(null)).toBe('/login/username');
	});

	it('sends returning users straight to the app', () => {
		expect(getPostLoginDestination({ username: 'coach', photoURL: 'x' })).toBe('/');
	});
});
