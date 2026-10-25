import {
	DEFAULT_PREFERENCES,
	UID,
	USERNAME,
	expect,
	openTab,
	signIn,
	storedSets,
	test,
	writeDoc
} from './fixtures';

/**
 * Exercises measured by distance, time and a hold, end to end: typed in by
 * hand, timed on the run screen (on Playwright's clock, so minutes pass in
 * an instant), and the question asked on coming back past a target.
 */

test.use({ seed: 'empty' });

const RUN = { id: 'workout-run', name: 'E2E Run', measure: 'distance' };
const BIKE = { id: 'workout-bike', name: 'E2E Bike', measure: 'time' };
const BRIDGE = { id: 'workout-bridge', name: 'E2E Bridge', measure: 'hold' };

async function seedExercises(routine?: Record<string, unknown>) {
	await writeDoc(`users/${UID}`, {
		username: USERNAME,
		photoURL: null,
		preferences: { ...DEFAULT_PREFERENCES, distanceUnit: 'km' }
	});
	for (const [i, w] of [RUN, BIKE, BRIDGE].entries()) {
		await writeDoc(`users/${UID}/workouts/${w.id}`, { ...w, sets: [], createdAt: i + 1 });
	}
	if (routine) await writeDoc(`users/${UID}/routines/${routine.id}`, routine);
}

test('a run is logged by hand with its pace, and History adds up the distance', async ({
	page
}) => {
	await seedExercises();
	await signIn(page);
	await openTab(page, 'Today');

	await page.getByRole('button', { name: /^(Log a single set|Just log a set)/ }).click();
	await page
		.getByRole('button', { name: new RegExp(`^${RUN.name}`) })
		.first()
		.click();
	await page.getByRole('textbox', { name: 'distance' }).fill('5');
	await page.getByRole('textbox', { name: 'Time minutes' }).fill('25');
	await page.getByRole('textbox', { name: 'Time seconds' }).fill('0');
	await expect(page.getByText('5:00 /km')).toBeVisible();

	await page.getByRole('button', { name: /^Log set/ }).click();
	await expect
		.poll(async () => (await storedSets(RUN.id))[0])
		.toMatchObject({ reps: 0, meters: 5000, seconds: 1500 });

	await openTab(page, 'History');
	await expect(page.getByText('km this week')).toBeVisible();
});

test.describe('timed sets on the run screen', () => {
	const ROUTINE = {
		id: 'routine-cardio',
		name: 'E2E Cardio',
		exercises: [{ workoutId: BIKE.id, targetSets: 2, targetSeconds: 60 }],
		createdAt: 1
	};

	test('a set is timed, and coming back past the target asks which time to log', async ({
		page
	}) => {
		await seedExercises(ROUTINE);
		await page.clock.install();
		await signIn(page);
		await openTab(page, 'Today');
		await page.getByRole('button', { name: `Start ${ROUTINE.name}`, exact: true }).click();
		await expect(page.getByText('Target 2 × 1 min')).toBeVisible();

		// Timed for a minute and a half, then stopped: that's the set.
		await page.getByRole('button', { name: 'Start set 1' }).click();
		await page.clock.fastForward('01:30');
		await page.getByRole('button', { name: /^Stop and log/ }).click();
		await expect.poll(async () => (await storedSets(BIKE.id)).map((s) => s.seconds)).toEqual([90]);

		// Set two runs on while the app is away (a reload stands in for coming
		// back): it offers the target or the full time.
		await page.getByRole('button', { name: 'Start set 2' }).click();
		await page.clock.fastForward('02:10');
		await page.reload();
		await expect(page.getByText('You passed 1:00 while away')).toBeVisible();
		await page.getByRole('button', { name: 'Log 1:00' }).click();
		await expect
			.poll(async () => (await storedSets(BIKE.id)).map((s) => s.seconds))
			.toEqual([90, 60]);
	});
});

test.describe('hold sets on the run screen', () => {
	const ROUTINE = {
		id: 'routine-pt',
		name: 'E2E PT',
		exercises: [{ workoutId: BRIDGE.id, targetSets: 1, minReps: 3, maxReps: 3, holdSeconds: 2 }],
		createdAt: 1
	};

	test('the hold timer counts the reps it holds', async ({ page }) => {
		await seedExercises(ROUTINE);
		await page.clock.install();
		await signIn(page);
		await openTab(page, 'Today');
		await page.getByRole('button', { name: `Start ${ROUTINE.name}`, exact: true }).click();
		await expect(page.getByText('Target 3 × 2s hold')).toBeVisible();

		await page.getByRole('button', { name: 'Start', exact: true }).click();
		// Three 2 s holds with a 2 s breath between them.
		await page.clock.runFor(11_000);
		await expect(page.getByText('Done', { exact: true })).toBeVisible();
		await page
			.getByRole('button', { name: /^Log set 1/ })
			.last()
			.click();
		await expect
			.poll(async () => (await storedSets(BRIDGE.id))[0])
			.toMatchObject({ reps: 3, holdSeconds: 2 });
	});
});
