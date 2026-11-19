import { availableParallelism } from 'node:os';
import { devices, type PlaywrightTestConfig } from '@playwright/test';

/**
 * End-to-end tests run against the Firebase Auth and Firestore emulators —
 * start them with `pnpm test:e2e`, which sets FIREBASE_AUTH_EMULATOR_HOST and
 * FIRESTORE_EMULATOR_HOST for everything it runs, this server included.
 */
const config: PlaywrightTestConfig = {
	webServer: {
		command: 'pnpm run build && pnpm run preview',
		port: 4173,
		env: { PUBLIC_FIREBASE_EMULATORS: 'true' }
	},
	testDir: 'tests',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/,
	use: {
		baseURL: 'http://localhost:4173',
		// The app's service worker caches pages between tests; each test starts clean.
		serviceWorkers: 'block',
		// Something to look at when a run fails, locally or in CI's uploaded results.
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure'
	},
	// Desktop Chrome, and WebKit at iPhone size — the closest to the installed
	// iOS PWA.
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'iphone', use: { ...devices['iPhone 15'] } }
	],
	retries: 2,
	timeout: 30 * 1000,
	// Workers share the emulators, each signed in as its own user (see
	// tests/fixtures.ts), so any test can run beside any other. More than 3 at
	// once has made WebKit's Firestore client give up as offline mid sign-in,
	// so locally it's 3 at most, and half the cores on a smaller machine. CI's
	// 4-core runners get 2.
	fullyParallel: true,
	workers: process.env.CI ? 2 : Math.max(1, Math.min(3, Math.floor(availableParallelism() / 2)))
};

export default config;
