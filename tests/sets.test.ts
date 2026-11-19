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

	const weightBefore = (await storedSets(EXERCISES[0].id))[0].weight ?? 0;

	// Edit: one more rep and 10 more pounds. The sheet opens without focusing
	// the reps number, so nothing is selected and no keypad comes up.
	await loggedSet.click();
	const sheet = page.getByRole('dialog');
	await expect(sheet.getByRole('button', { name: 'Increase reps by 1' })).toBeVisible();
	await expect(sheet.getByRole('textbox', { name: 'reps' })).not.toBeFocused();
	await sheet.getByRole('button', { name: 'Increase reps by 1' }).click();
	await sheet.getByRole('button', { name: 'Increase weight by 10' }).click();
	await page.getByRole('button', { name: 'Save' }).click();
	await expect
		.poll(async () => {
			const [set] = await storedSets(EXERCISES[0].id);
			return { reps: set?.reps, weight: set?.weight };
		})
		.toEqual({ reps: repsBefore + 1, weight: weightBefore + 10 });

	// Then delete the edited set — the case that used to fail silently.
	await loggedSet.click();
	await page.getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByText('Delete this set?')).toBeVisible();
	await page.getByRole('button', { name: 'Delete', exact: true }).last().click();

	await expect.poll(async () => (await storedSets(EXERCISES[0].id)).length).toBe(0);
	await expect(loggedSet).toBeHidden();
});

test('the Record Set sheet saves what its steppers show', async ({ page }) => {
	await signIn(page);
	await page.goto(`/workout/${EXERCISES[1].id}`);
	await page.getByRole('button', { name: 'Record a set' }).click();

	const sheet = page.getByRole('dialog');
	const reps = sheet.getByRole('textbox', { name: 'reps' });
	await expect(reps).toBeVisible();
	const repsBefore = Number(await reps.inputValue());
	const weightBefore = Number(await sheet.getByRole('textbox', { name: 'weight' }).inputValue());

	await sheet.getByRole('button', { name: 'Increase reps by 1' }).click();
	await sheet.getByRole('button', { name: 'Increase weight by 10' }).click();
	await sheet.getByRole('button', { name: 'Increase weight by 2.5' }).click();
	await sheet.getByRole('button', { name: 'Decrease weight by 2.5' }).click();
	await sheet.getByRole('button', { name: 'Increase weight by 2.5' }).click();
	await page.getByRole('button', { name: 'Record Set', exact: true }).click();

	await expect
		.poll(async () => {
			const [set] = await storedSets(EXERCISES[1].id);
			return { reps: set?.reps, weight: set?.weight };
		})
		.toEqual({ reps: repsBefore + 1, weight: weightBefore + 12.5 });
});
