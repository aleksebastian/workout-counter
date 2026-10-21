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
	test
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
		await expect(page).toHaveURL(/\/train$/);
		await openTab(page, 'Home');
		await expect(page.getByText('Last session')).toBeVisible();
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

	// Starting it again offers to pick up where it left off.
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await page.getByRole('button', { name: `Start ${ROUTINE.name}`, exact: true }).click();
	await expect(page.getByText(`${ROUTINE.name} ended early today`)).toBeVisible();
	await page.getByRole('button', { name: 'Resume workout' }).click();

	// Back in progress with the set still counted, and out of the history.
	await expect(page.getByRole('heading', { name: EXERCISES[0].name })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Set 1: .*Edit$/ })).toBeVisible();
	await expect.poll(async () => (await sessions()).length).toBe(0);
	expect((await readDoc(`users/${UID}`))?.activeSession).toBeTruthy();
});
