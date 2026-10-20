import { expect, signIn, test } from './fixtures';

test('a signed-out visitor lands on the login page', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/login/);
	await expect(page.getByRole('heading', { name: 'SetCount' })).toBeVisible();
});

const HOME = /^Good (morning|afternoon|evening)/;

test('a device still signed in walks back in when its server session is gone', async ({ page }) => {
	await signIn(page);
	// What an expired cookie looks like to the server: the next page load that
	// reaches it (an update reload, say) is sent to /login.
	await page.context().clearCookies({ name: '__session' });
	await page.goto('/');

	await expect(page.getByRole('heading', { name: HOME })).toBeVisible();
	await expect(page.getByText("Couldn't start your session")).toHaveCount(0);
	expect(await page.context().cookies()).toContainEqual(
		expect.objectContaining({ name: '__session' })
	);
});

test('the server session is renewed while the app is in use', async ({ page }) => {
	await signIn(page);
	await page.context().clearCookies({ name: '__session' });
	await page.evaluate(() => {
		localStorage.removeItem('sc-session-renewed');
		document.dispatchEvent(new Event('visibilitychange'));
	});

	await expect
		.poll(async () => (await page.context().cookies()).map((c) => c.name))
		.toContain('__session');
});

test('a sign-in the server rejects is dropped so the next tap goes back to Google', async ({
	page
}) => {
	await signIn(page);
	await page.context().clearCookies({ name: '__session' });
	await page.route('**/api/signin', (route) =>
		route.request().method() === 'POST'
			? route.fulfill({ status: 401, json: { reason: 'invalid-token' } })
			: route.continue()
	);
	await page.goto('/');

	await expect(page.getByText('Your sign-in expired.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
	// Signed out on the device too (no account avatar), so a tap opens Google
	// rather than retrying the same rejected finish.
	await expect(page.getByRole('button', { name: 'Account' })).toHaveCount(0);
});
