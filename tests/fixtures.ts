import { test as base, expect, type Page } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Shared setup for the end-to-end tests. Everything runs against the Firebase
 * emulators (see playwright.config.ts): before each test the database is
 * wiped and seeded with one signed-up user, plus whatever the test's seed
 * variant adds (see `Seed`).
 */

export const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'workout-counter-99d56';
export const UID = 'e2e-user';
export const USERNAME = 'e2etester';
export const ROUTINE = { id: 'routine-e2e', name: 'E2E Routine' };
export const EXERCISES = [
	{ id: 'workout-squat', name: 'E2E Squat' },
	{ id: 'workout-press', name: 'E2E Press' }
];

/**
 * - `default`: two exercises and a routine of 3 sets each with a 1:30 timer.
 * - `empty`: the account alone — for creating things from scratch.
 * - `oneSet`: a routine of one exercise and one set, so a test can finish it.
 */
export type Seed = 'default' | 'empty' | 'oneSet';

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

export const DEFAULT_PREFERENCES = {
	timer: { minutes: 1, seconds: 30 },
	timerEnabled: false,
	theme: 'light',
	weightUnit: 'lbs',
	weekStart: 0,
	weeklyGoal: 3,
	streaksEnabled: true
};

async function seed(variant: Seed) {
	await adminAuth.createUser({ uid: UID, displayName: 'E2E Tester' }).catch((e) => {
		if (e.code !== 'auth/uid-already-exists') throw e;
	});
	const now = Date.now();
	const batch = adminDB.batch();
	batch.set(adminDB.doc(`usernames/${USERNAME}`), { uid: UID });
	batch.set(adminDB.doc(`users/${UID}`), {
		username: USERNAME,
		photoURL: null,
		preferences: DEFAULT_PREFERENCES
	});
	if (variant !== 'empty') {
		const exercises = variant === 'oneSet' ? EXERCISES.slice(0, 1) : EXERCISES;
		const targetSets = variant === 'oneSet' ? 1 : 3;
		exercises.forEach((w, i) =>
			batch.set(adminDB.doc(`users/${UID}/workouts/${w.id}`), {
				...w,
				sets: [],
				createdAt: now + i
			})
		);
		batch.set(adminDB.doc(`users/${UID}/routines/${ROUTINE.id}`), {
			...ROUTINE,
			exercises: exercises.map((w) => ({ workoutId: w.id, targetSets, minReps: 8, maxReps: 12 })),
			timer: { minutes: 1, seconds: 30 },
			createdAt: now
		});
	}
	await batch.commit();
}

/** A document straight from the emulator, or undefined if it doesn't exist. */
export async function readDoc(path: string) {
	return (await adminDB.doc(path).get()).data();
}

/** Every document in a collection, straight from the emulator. */
export async function listDocs(path: string) {
	return (await adminDB.collection(path).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Writes a document directly — for state a test needs before it starts. */
export async function writeDoc(path: string, data: Record<string, unknown>) {
	await adminDB.doc(path).set(data);
}

/** The sets stored for an exercise, straight from the emulator. */
export async function storedSets(workoutId: string) {
	const doc = await readDoc(`users/${UID}/workouts/${workoutId}`);
	return (doc?.sets ?? []) as { id: string; reps: number; weight?: number }[];
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
	await expect(
		page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })
	).toBeVisible();
}

/** Opens a bottom-nav tab: Home, Train, Library or Discover. */
export async function openTab(page: Page, name: 'Home' | 'Train' | 'Library' | 'Discover') {
	// Train's label grows to "Train, workout in progress" during a workout.
	const label = name === 'Train' ? /^Train/ : name;
	await page.getByRole('link', { name: label, exact: name !== 'Train' }).click();
}

/** From Home: open Train and start the seeded routine. */
export async function startRoutine(page: Page) {
	await openTab(page, 'Train');
	await page.getByRole('button', { name: `Start ${ROUTINE.name}`, exact: true }).click();
	await expect(page.getByRole('heading', { name: EXERCISES[0].name })).toBeVisible();
}

export const test = base.extend<{ seed: Seed; seeded: void }>({
	seed: ['default', { option: true }],
	seeded: [
		async ({ seed: variant }, use) => {
			await resetFirestore();
			await seed(variant);
			await use();
		},
		{ auto: true }
	]
});

export { expect };
