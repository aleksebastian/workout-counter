import { EXERCISES, expect, signIn, startRoutine, storedSets, test } from './fixtures';

test('log a set, skip the rest, then discard the workout', async ({ page }) => {
	await signIn(page);
	await startRoutine(page);

	await page
		.getByRole('button', { name: /^Log set 1/ })
		.last()
		.click();
	await expect.poll(async () => (await storedSets(EXERCISES[0].id)).length).toBe(1);

	const skipRest = page.getByRole('button', { name: 'Dismiss rest timer' });
	await expect(skipRest).toBeVisible();
	await skipRest.click();
	await expect(skipRest).toBeHidden();

	await page.getByRole('button', { name: 'Finish' }).click();
	await page.getByRole('button', { name: 'Discard workout' }).click();
	await page.getByRole('button', { name: 'Discard workout' }).click();

	await expect(page.getByText('Workout discarded')).toBeVisible();
	await expect(page).toHaveURL(/\/train$/);
	await expect.poll(async () => (await storedSets(EXERCISES[0].id)).length).toBe(0);
});
