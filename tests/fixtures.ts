import { test as base, expect, type Page } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Shared setup for the end-to-end tests. Everything runs against the Firebase
 * emulators (see playwright.config.ts): before each test the database is
 * wiped and seeded with one signed-up user, two exercises and a routine.
 */

export const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'workout-counter-99d56';
export const UID = 'e2e-user';
export const USERNAME = 'e2etester';
export const ROUTINE = { id: 'routine-e2e', name: 'E2E Routine' };
export const EXERCISES = [
	{ id: 'workout-squat', name: 'E2E Squat' },
	{ id: 'workout-press', name: 'E2E Press' }
];

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
	throw new Error('Run the end-to-end tests with `pnpm test:e2e`, which starts the emulators.');
}

if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
const adminDB = getFirestore();
const adminAuth = getAuth();

async function resetFirestore() {
	const res = await fetch(
		`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
		{ method: 'DELETE' }
	);
	if (!res.ok) throw new Error(`Couldn't clear the Firestore emulator: ${res.status}`);
}

async function seed() {
	await adminAuth.createUser({ uid: UID, displayName: 'E2E Tester' }).catch((e) => {
		if (e.code !== 'auth/uid-already-exists') throw e;
	});
	const now = Date.now();
	const batch = adminDB.batch();
	batch.set(adminDB.doc(`usernames/${USERNAME}`), { uid: UID });
	batch.set(adminDB.doc(`users/${UID}`), {
		username: USERNAME,
		photoURL: null,
		preferences: {
			timer: { minutes: 1, seconds: 30 },
			timerEnabled: false,
			theme: 'light',
			weightUnit: 'lbs',
			weekStart: 0,
			weeklyGoal: 3,
			streaksEnabled: true
		}
	});
	EXERCISES.forEach((w, i) =>
		batch.set(adminDB.doc(`users/${UID}/workouts/${w.id}`), { ...w, sets: [], createdAt: now + i })
	);
	batch.set(adminDB.doc(`users/${UID}/routines/${ROUTINE.id}`), {
		...ROUTINE,
		exercises: EXERCISES.map((w) => ({ workoutId: w.id, targetSets: 3, minReps: 8, maxReps: 12 })),
		timer: { minutes: 1, seconds: 30 },
		createdAt: now
	});
	await batch.commit();
}

/** The sets stored for an exercise, straight from the emulator. */
export async function storedSets(workoutId: string) {
	const doc = await adminDB.doc(`users/${UID}/workouts/${workoutId}`).get();
	return (doc.get('sets') ?? []) as { id: string; reps: number }[];
}

/**
 * Signs the seeded user in through the app's test hook — the real sign-in
 * path minus Google's popup — and waits for the home screen.
 */
export async function signIn(page: Page, { persistence = false } = {}) {
	const token = await adminAuth.createCustomToken(UID);
	await page.goto(persistence ? '/login?e2ePersistence=1' : '/login');
	await page.waitForFunction(() => typeof window.__e2eSignIn === 'function');
	await page.evaluate((t) => window.__e2eSignIn!(t), token);
	await expect(page.getByText(ROUTINE.name).first()).toBeVisible();
}

/** From Home: open Train and start the seeded routine. */
export async function startRoutine(page: Page) {
	await page.getByRole('link', { name: 'Train' }).click();
	await page
		.locator('div')
		.filter({ has: page.getByText(ROUTINE.name, { exact: true }) })
		.getByRole('button', { name: 'Start' })
		.last()
		.click();
	await expect(page.getByRole('heading', { name: EXERCISES[0].name })).toBeVisible();
}

export const test = base.extend<{ seeded: void }>({
	seeded: [
		// eslint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure
		async ({}, use) => {
			await resetFirestore();
			await seed();
			await use();
		},
		{ auto: true }
	]
});

export { expect };
