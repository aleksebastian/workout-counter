import type { Page } from '@playwright/test';
import { UID, expect, listDocs, openTab, readDoc, signIn, test } from './fixtures';

test.use({ seed: 'empty' });

/** The Library's Exercises / Routines / Programs switch. */
async function librarySegment(page: Page, name: 'Exercises' | 'Routines' | 'Programs') {
	await page
		.getByRole('tab', { name, exact: true })
		.or(page.getByRole('button', { name, exact: true }))
		.first()
		.click();
}

/** Fills and submits the NameSheet the + button opens. */
async function createNamed(page: Page, fab: string, title: string, name: string, submit: string) {
	await page.getByRole('button', { name: fab, exact: true }).click();
	// New routine first asks how: from scratch, from a photo, or ready-made.
	if (fab === 'New routine') {
		await page
			.getByRole('dialog')
			.getByRole('button', { name: /^Start from scratch/ })
			.click();
	}
	const input = page.getByRole('textbox', { name: title });
	await input.fill(name);
	await page.getByRole('button', { name: submit, exact: true }).click();
}

const docsNamed = async (collection: string, name: string) =>
	(await listDocs(`users/${UID}/${collection}`)).filter(
		(d) => (d as { name?: string }).name === name
	);

test('create, validate, rename and delete an exercise', async ({ page }) => {
	await signIn(page);
	await openTab(page, 'Library');
	await librarySegment(page, 'Exercises');

	// Empty and duplicate names are refused, with a reason.
	await page.getByRole('button', { name: 'New exercise', exact: true }).click();
	await page.getByRole('button', { name: 'Add Exercise', exact: true }).click();
	await expect(page.getByText('Workout name missing')).toBeVisible();
	await page.getByRole('textbox', { name: 'New exercise' }).fill('Goblet Squat');
	await page.getByRole('button', { name: 'Add Exercise', exact: true }).click();
	await expect.poll(async () => (await docsNamed('workouts', 'Goblet Squat')).length).toBe(1);
	// A new exercise opens on its own page; go back to the list.
	await expect(page).toHaveURL(/\/workout\//);
	await openTab(page, 'Library');
	await librarySegment(page, 'Exercises');

	await createNamed(page, 'New exercise', 'New exercise', '  goblet SQUAT ', 'Add Exercise');
	await expect(page.getByText('Workout already exists')).toBeVisible();
	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	expect((await listDocs(`users/${UID}/workouts`)).length).toBe(1);

	// Rename through the row menu.
	await page.getByRole('button', { name: 'Options for Goblet Squat' }).click();
	await page.getByRole('button', { name: 'Edit exercise' }).click();
	const nameField = page.getByRole('dialog').getByRole('textbox').first();
	await nameField.fill('Front Squat');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByText('Front Squat', { exact: true })).toBeVisible();
	await expect.poll(async () => (await docsNamed('workouts', 'Front Squat')).length).toBe(1);

	// Delete, confirmed.
	await page.getByRole('button', { name: 'Options for Front Squat' }).click();
	await page.getByRole('button', { name: 'Delete exercise' }).click();
	await page
		.locator('dialog[open]')
		.filter({ hasText: 'Delete “Front Squat”?' })
		.getByRole('button', { name: 'Delete', exact: true })
		.click();
	await expect.poll(async () => (await listDocs(`users/${UID}/workouts`)).length).toBe(0);
	await expect(page.getByText('No exercises yet.')).toBeVisible();
});

test('build a routine with exercises and its own rest timer', async ({ page }) => {
	await signIn(page);
	await openTab(page, 'Library');
	await librarySegment(page, 'Exercises');
	await createNamed(page, 'New exercise', 'New exercise', 'Bench Press', 'Add Exercise');
	await expect.poll(async () => (await docsNamed('workouts', 'Bench Press')).length).toBe(1);
	await expect(page).toHaveURL(/\/workout\//);
	await openTab(page, 'Library');

	// A new routine opens on its own page.
	await librarySegment(page, 'Routines');
	await createNamed(page, 'New routine', 'New routine', 'Push Day', 'Add Routine');
	await expect(page).toHaveURL(/\/routines\//);

	// Add the existing exercise and create another inline.
	await page.getByRole('button', { name: 'Add exercises' }).last().click();
	await page.getByRole('button', { name: /^Bench Press,/ }).click();
	await page.getByLabel('Search or create an exercise').fill('Landmine Twist');
	await page.getByRole('button', { name: /Create “Landmine Twist”/ }).click();
	await page.getByRole('button', { name: /^Add 2 / }).click();

	await expect
		.poll(async () => {
			const [routine] = await docsNamed('routines', 'Push Day');
			return (routine as { exercises?: unknown[] } | undefined)?.exercises?.length;
		})
		.toBe(2);
	expect(await docsNamed('workouts', 'Landmine Twist')).toHaveLength(1);

	// Its own rest timer.
	await page.getByRole('button', { name: 'Edit rest timer' }).click();
	const custom = page.getByRole('checkbox', { name: 'Use a custom rest timer for this routine' });
	if (!(await custom.isChecked())) await custom.check();
	await page.getByRole('spinbutton', { name: 'Rest minutes' }).fill('0');
	await page.getByRole('spinbutton', { name: 'Rest seconds' }).fill('45');
	await page.getByRole('button', { name: 'Save', exact: true }).click();

	await expect
		.poll(async () => {
			const [routine] = await docsNamed('routines', 'Push Day');
			return (routine as { timer?: unknown } | undefined)?.timer;
		})
		.toEqual({ minutes: 0, seconds: 45 });
	await expect(page.getByText('0:45').first()).toBeVisible();
});

test('create and delete a program', async ({ page }) => {
	await signIn(page);
	await openTab(page, 'Library');
	await librarySegment(page, 'Programs');
	await createNamed(page, 'New program', 'New program', 'Strength Block', 'Add Program');
	await expect(page).toHaveURL(/\/programs\//);
	await expect.poll(async () => (await docsNamed('programs', 'Strength Block')).length).toBe(1);

	await openTab(page, 'Library');
	await librarySegment(page, 'Programs');
	await page.getByRole('button', { name: 'Options for Strength Block' }).click();
	await page.getByRole('button', { name: 'Delete program' }).click();
	await page
		.locator('dialog[open]')
		.filter({ hasText: 'Delete “Strength Block”?' })
		.getByRole('button', { name: 'Delete', exact: true })
		.click();
	await expect.poll(async () => (await listDocs(`users/${UID}/programs`)).length).toBe(0);
	expect(await readDoc(`users/${UID}`)).toBeTruthy();
});
