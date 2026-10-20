import { EXERCISES, expect, signIn, startRoutine, storedSets, test } from './fixtures';

test('a set edited and then deleted is gone', async ({ page }) => {
	await signIn(page);
	await startRoutine(page);

	await page
		.getByRole('button', { name: /^Log set 1/ })
		.last()
		.click();
	await expect.poll(async () => (await storedSets(EXERCISES[0].id)).length).toBe(1);
	const repsBefore = (await storedSets(EXERCISES[0].id))[0].reps;
	const loggedSet = page.getByRole('button', { name: /^Set 1: .*Edit$/ });

	// Edit: one more rep.
	await loggedSet.click();
	await page.getByRole('button', { name: 'Increase reps', exact: true }).click();
	await page.getByRole('button', { name: 'Save' }).click();
	await expect.poll(async () => (await storedSets(EXERCISES[0].id))[0]?.reps).toBe(repsBefore + 1);

	// Then delete the edited set — the case that used to fail silently.
	await loggedSet.click();
	await page.getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByText('Delete this set?')).toBeVisible();
	await page.getByRole('button', { name: 'Delete', exact: true }).last().click();

	await expect.poll(async () => (await storedSets(EXERCISES[0].id)).length).toBe(0);
	await expect(loggedSet).toBeHidden();
});
