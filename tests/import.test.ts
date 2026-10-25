import { UID, expect, fixWeekday, listDocs, openTab, signIn, test, writeDoc } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Without an API key the e2e build's import endpoint returns a fixed read of a
 * push day (Bench Press, Overhead Press, Cable Fly); a note naming a program
 * puts it on the user's first program, Monday morning. See `sampleExtraction`.
 */

test.use({ seed: 'empty' });

/** A 1×1 PNG: enough for the browser to decode and resize. */
const PIXEL = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

type Routine = {
	id: string;
	name: string;
	exercises: { workoutId: string; targetSets?: number }[];
};
type Program = {
	id: string;
	schedule: { day: number; sessions: { slot?: string; items: { routineId?: string }[] }[] }[];
};

async function importPhoto(page: Page, note: string) {
	await expect(page.getByRole('heading', { name: 'Import from photo' })).toBeVisible();
	await page.getByTestId('import-photo-input').setInputFiles({
		name: 'workout.png',
		mimeType: 'image/png',
		buffer: PIXEL
	});
	await page.getByLabel('What should we do with it?').fill(note);
	await page.getByRole('button', { name: 'Read workout' }).click();
	await expect(page.getByRole('heading', { name: 'Check your routine' })).toBeVisible();
}

test('import a photo as a new routine from the Library', async ({ page }) => {
	await signIn(page);
	await page.goto('/library?tab=routines');
	await page.getByRole('button', { name: 'New routine' }).click();
	// The menu's row, not the empty state's button of the same name.
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /^Import from photo/ })
		.click();
	await importPhoto(page, 'Add to my routines');

	await expect(page.getByText('Overhead Press')).toBeVisible();
	await page.getByRole('button', { name: 'Save routine' }).click();

	await expect(page).toHaveURL(/\/routines\//);
	await expect
		.poll(async () => ((await listDocs(`users/${UID}/routines`)) as Routine[]).map((r) => r.name))
		.toEqual(['Push Day']);
	const [routine] = (await listDocs(`users/${UID}/routines`)) as Routine[];
	expect(routine.exercises.map((e) => e.targetSets)).toEqual([4, 3, 3]);
	const names = ((await listDocs(`users/${UID}/workouts`)) as unknown as { name: string }[]).map(
		(w) => w.name
	);
	expect(names).toHaveLength(3);
	expect(names).toContain('Cable Fly');
});

/** Seeds a program and imports the sample with a note naming it: Mon, Wed and Fri mornings. */
async function importToProgram(page: Page) {
	await fixWeekday(page, 3);
	await writeDoc(`users/${UID}/programs/ppl`, {
		id: 'ppl',
		name: 'E2E Program',
		schedule: [],
		createdAt: 1
	});
	await signIn(page);
	await page.goto('/library?tab=routines');
	await page.getByRole('button', { name: 'New routine' }).click();
	// The menu's row, not the empty state's button of the same name.
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /^Import from photo/ })
		.click();
	await importPhoto(page, 'Add to my program Mon, Wed and Fri mornings');
	await expect(page.getByText('E2E Program · Mon, Wed, Fri · Morning')).toBeVisible();
}

/** The saved program's days, each with its sessions. */
async function savedSchedule() {
	await expect
		.poll(async () => ((await listDocs(`users/${UID}/programs`)) as Program[])[0].schedule.length)
		.toBeGreaterThan(0);
	return ((await listDocs(`users/${UID}/programs`)) as Program[])[0].schedule;
}

test("put a photo's routine on every day the note names", async ({ page }) => {
	await importToProgram(page);
	await page.getByRole('button', { name: 'Add to program' }).click();

	await expect(page).toHaveURL(/\/programs\/ppl/);
	await expect(page.getByText('Added to 3 days of your program')).toBeVisible();
	const schedule = await savedSchedule();
	const [routine] = (await listDocs(`users/${UID}/routines`)) as Routine[];
	expect(schedule.map((d) => d.day)).toEqual([1, 3, 5]);
	for (const day of schedule) {
		expect(day.sessions).toMatchObject([{ slot: 'morning', items: [{ routineId: routine.id }] }]);
	}
});

test('change the days in the picker before saving', async ({ page }) => {
	await importToProgram(page);
	await page.getByRole('button', { name: /Save to/ }).click();
	const days = page.getByRole('group', { name: 'Days' });
	await days.getByRole('button', { name: 'Sunday' }).click();
	await days.getByRole('button', { name: 'Wednesday' }).click();
	await expect(days.getByRole('button', { name: 'Wednesday' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(page.getByText('E2E Program · Sun, Mon, Fri · Morning')).toBeVisible();
	await page.getByRole('button', { name: 'Add to program' }).click();

	await expect(page).toHaveURL(/\/programs\/ppl/);
	expect((await savedSchedule()).map((d) => d.day)).toEqual([0, 1, 5]);
});

test('Discover offers uploading your own workout', async ({ page }) => {
	await signIn(page);
	await openTab(page, 'Discover');
	await page.getByRole('button', { name: 'Upload your own' }).click();
	await expect(page.getByRole('heading', { name: 'Import from photo' })).toBeVisible();
});
