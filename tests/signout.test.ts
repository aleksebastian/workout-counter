import { expect, signIn, test } from './fixtures';

test("signing out clears the account's data from the device", async ({ page }) => {
	// With the real IndexedDB cache, which is what sign-out has to clear.
	await signIn(page, { persistence: true });
	const firestoreDatabases = () =>
		page.evaluate(async () =>
			(await indexedDB.databases()).map((d) => d.name ?? '').filter((n) => n.includes('firestore'))
		);
	expect((await firestoreDatabases()).length).toBeGreaterThan(0);
	await page.evaluate(() => localStorage.setItem('sc-setup-complete-seen', 'true'));

	await page.getByRole('button', { name: 'Account' }).click();
	await page.getByRole('button', { name: 'Sign out' }).click();

	await expect(page).toHaveURL(/\/login/);
	await expect(page.getByRole('heading', { name: 'SetCount' })).toBeVisible();
	await expect.poll(firestoreDatabases).toEqual([]);
	expect(await page.evaluate(() => localStorage.getItem('sc-setup-complete-seen'))).toBeNull();
});
