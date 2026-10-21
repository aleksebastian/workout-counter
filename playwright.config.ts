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
	// iOS PWA. They share the emulator database, so tests run one at a time.
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'iphone', use: { ...devices['iPhone 15'] } }
	],
	retries: 2,
	timeout: 30 * 1000,
	workers: 1
};

export default config;
