import { EXERCISES, expect, openTab, signIn, storedSets, test } from './fixtures';

test('a single set is logged from Today without leaving it', async ({ page }) => {
	const [, press] = EXERCISES;
	await signIn(page);
	await openTab(page, 'Today');

	await page.getByRole('button', { name: /^Log a single set/ }).click();
	await page
		.getByRole('button', { name: new RegExp(`^${press.name}`) })
		.first()
		.click();

	const before = (await storedSets(press.id)).length;
	await page.getByRole('button', { name: /^Log set/ }).click();
	await expect.poll(async () => (await storedSets(press.id)).length).toBe(before + 1);
	await expect(page.getByText(`${press.name} · set logged`)).toBeVisible();
	await expect(page).toHaveURL(/\/$/);
});

test('the old Train tab lands on Today', async ({ page }) => {
	await signIn(page);
	await page.goto('/train');
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('link', { name: /^Today/ }).last()).toHaveAttribute(
		'aria-current',
		'page'
	);
});
