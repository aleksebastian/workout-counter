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

test('moving between tabs asks the server for nothing', async ({ page }) => {
	await signIn(page);
	// The root layout's server guard runs on full page loads only, so neither
	// a tab change nor a hover preload fetches its data.
	const dataRequests: string[] = [];
	page.on('request', (r) => {
		if (r.url().includes('__data.json')) dataRequests.push(r.url());
	});
	for (const tab of ['History', 'Library', 'Discover', 'Today'] as const) {
		await openTab(page, tab);
		await expect(
			page.getByRole('link', { name: tab === 'Today' ? /^Today/ : tab }).last()
		).toHaveAttribute('aria-current', 'page');
	}
	await page.getByRole('link', { name: 'History', exact: true }).last().hover();
	expect(dataRequests).toEqual([]);
});
