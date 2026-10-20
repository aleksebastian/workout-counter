import { expect, test } from './fixtures';

test('a signed-out visitor lands on the login page', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/login/);
	await expect(page.getByRole('heading', { name: 'SetCount' })).toBeVisible();
});
