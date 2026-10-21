import {
	EXERCISES,
	UID,
	expect,
	readDoc,
	signIn,
	startRoutine,
	storedSets,
	test
} from './fixtures';

/** Preferences save themselves shortly after each change. */
const savedPreferences = async () =>
	(await readDoc(`users/${UID}`))?.preferences as Record<string, unknown> | undefined;

test('weights show in kg once the unit is switched', async ({ page }) => {
	await signIn(page);
	await page.goto('/preferences');
	await page.getByRole('button', { name: 'kg', exact: true }).click();
	await expect.poll(async () => (await savedPreferences())?.weightUnit).toBe('kg');

	await page.goto('/');
	await startRoutine(page);
	const table = page.getByRole('list', { name: 'Sets' });
	await expect(page.getByText('kg', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('lb', { exact: true })).toHaveCount(0);
	await expect(table).toBeVisible();
});

test('the global rest timer runs, with its own duration, after a single set', async ({ page }) => {
	await signIn(page);
	await page.goto('/preferences');
	await page.getByRole('checkbox', { name: 'Global rest timer' }).check();
	await page.getByRole('spinbutton', { name: 'Rest minutes' }).fill('0');
	await page.getByRole('spinbutton', { name: 'Rest seconds' }).fill('20');
	await page.getByRole('spinbutton', { name: 'Rest seconds' }).blur();
	await expect
		.poll(async () => {
			const prefs = await savedPreferences();
			return { enabled: prefs?.timerEnabled, timer: prefs?.timer };
		})
		.toEqual({ enabled: true, timer: { minutes: 0, seconds: 20 } });

	// Outside any routine, so the global timer is the one that applies.
	await page.goto(`/workout/${EXERCISES[1].id}`);
	await page.getByRole('button', { name: 'Record a set' }).click();
	await page.getByRole('button', { name: 'Record Set', exact: true }).click();
	await expect.poll(async () => (await storedSets(EXERCISES[1].id)).length).toBe(1);

	await expect(page.getByText(/^0:(1\d|20)$/).first()).toBeVisible();
	await expect(page.getByText('E2E Routine timer')).toHaveCount(0);
});

test('a dark theme applies and survives a reload', async ({ page }) => {
	await signIn(page);
	await page.goto('/preferences');
	await page.getByRole('button', { name: 'Dark', exact: true }).click();

	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'dracula');
	await expect.poll(async () => (await savedPreferences())?.theme).toBe('dark');

	await page.reload();
	await expect(html).toHaveAttribute('data-theme', 'dracula');
});
