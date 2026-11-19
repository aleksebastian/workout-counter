import type { Page } from '@playwright/test';
import {
	EXERCISES,
	ROUTINE,
	UID,
	expect,
	listDocs,
	openTab,
	readDoc,
	signIn,
	startRoutine,
	storedSets,
	test,
	writeDoc
} from './fixtures';

type SessionLog = { name?: string; endReason?: string; totals?: { sets: number; reps: number } };
const sessions = async () => (await listDocs(`users/${UID}/sessions`)) as SessionLog[];

async function logSet(page: Page) {
	const before = (await storedSets(EXERCISES[0].id)).length;
	await page
		.getByRole('button', { name: /^Log set \d/ })
		.last()
		.click();
	await expect.poll(async () => (await storedSets(EXERCISES[0].id)).length).toBe(before + 1);
}

test.describe('a finished routine', () => {
	test.use({ seed: 'oneSet' });

	test('lands in the history with its totals', async ({ page }) => {
		await signIn(page);
		await startRoutine(page);
		await logSet(page);
		const [set] = await storedSets(EXERCISES[0].id);

		// Every target met, so Finish needs no confirmation (the header's and the
		// footer's Finish do the same thing).
		await page.getByRole('button', { name: 'Finish', exact: true }).first().click();
		await expect(page.getByText('Workout complete')).toBeVisible();
		await expect(page.getByText(ROUTINE.name).first()).toBeVisible();

		await expect.poll(async () => (await sessions()).length).toBe(1);
		const [log] = await sessions();
		expect(log).toMatchObject({
			name: ROUTINE.name,
			endReason: 'finished',
			totals: { sets: 1, reps: set.reps }
		});
		expect((await readDoc(`users/${UID}`))?.activeSession).toBeUndefined();

		await page.getByRole('button', { name: 'Done', exact: true }).click();
		await expect(page).toHaveURL(/\/$/);
		// Today turns into the result.
		await expect(page.getByText('Done today')).toBeVisible();

		// History lists it, and it opens to the set it logged.
		await openTab(page, 'History');
		await page
			.getByRole('link', { name: new RegExp(ROUTINE.name) })
			.first()
			.click();
		await expect(page.getByRole('button', { name: /^Edit set 1:/ })).toBeVisible();
		await expect(page.getByText(EXERCISES[0].name).first()).toBeVisible();
	});
});

test('a workout ended early can be resumed the same day, without logging it twice', async ({
	page
}) => {
	await signIn(page);
	await startRoutine(page);
	await logSet(page);

	// End it early: 1 of 3 sets done.
	await page.getByRole('button', { name: 'Finish' }).click();
	await page
		.locator('dialog[open]')
		.filter({ hasText: 'Finish workout early?' })
		.getByRole('button', { name: 'Finish', exact: true })
		.click();
	await expect(page.getByText('Workout ended')).toBeVisible();
	await expect.poll(async () => (await sessions()).length).toBe(1);

	// Today offers to pick up where it left off.
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(page.getByText(/0 of 2 done today/)).toBeVisible();
	await page.getByRole('button', { name: 'Resume workout' }).click();

	// Back in progress with the set still counted, and out of the history.
	await expect(page.getByRole('heading', { name: EXERCISES[0].name })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Set 1: .*Edit$/ })).toBeVisible();
	await expect.poll(async () => (await sessions()).length).toBe(0);
	expect((await readDoc(`users/${UID}`))?.activeSession).toBeTruthy();
});

test('loads workouts older than the latest 100 on request', async ({ page }) => {
	const DAY = 24 * 3600_000;
	await Promise.all(
		Array.from({ length: 105 }, (_, i) => {
			const startedAt = Date.now() - (i + 1) * DAY;
			return writeDoc(`users/${UID}/sessions/old-${i + 1}`, {
				id: `old-${i + 1}`,
				source: { type: 'routine', routineId: ROUTINE.id },
				name: `Session ${i + 1}`,
				startedAt,
				endedAt: startedAt + 30 * 60_000,
				endReason: 'finished',
				complete: true,
				exercises: [],
				totals: { sets: 0, reps: 0 },
				createdAt: startedAt + 30 * 60_000
			});
		})
	);
	await signIn(page);
	await openTab(page, 'History');

	await expect(page.getByText('Session 100', { exact: true })).toBeVisible();
	await expect(page.getByText('Session 101', { exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Load older workouts' }).click();
	await expect(page.getByText('Session 105', { exact: true })).toBeVisible();
	// Fewer than a page came back, so that was all of them.
	await expect(page.getByRole('button', { name: 'Load older workouts' })).toHaveCount(0);
});
