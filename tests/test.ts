import { expect, test } from '@playwright/test';

test('index redirects to login and shows app heading', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'SetCount' })).toBeVisible();
});
