import {
	UID,
	expect,
	fixWeekday,
	listDocs,
	openTab,
	readDoc,
	signIn,
	test,
	writeDoc
} from './fixtures';

test.use({ seed: 'empty' });

type Named = { id: string; name?: string };
const workouts = async () => (await listDocs(`users/${UID}/workouts`)) as Named[];
const routines = async () =>
	(await listDocs(`users/${UID}/routines`)) as (Named & { exercises?: { workoutId: string }[] })[];
const programs = async () => (await listDocs(`users/${UID}/programs`)) as Named[];

test('add a catalog routine and its exercises to the Library', async ({ page }) => {
	await signIn(page);
	await openTab(page, 'Discover');
	await page
		.getByRole('link', { name: /Full Body A\b/ })
		.first()
		.click();
	await page.getByRole('button', { name: 'Add to Library' }).click();

	await expect(page.getByText('Added “Full Body A” to your Library')).toBeVisible();
	await expect.poll(async () => (await routines()).map((r) => r.name)).toEqual(['Full Body A']);
	expect((await workouts()).length).toBe(5);

	// Discover now marks it as already in the Library.
	await openTab(page, 'Discover');
	await expect(
		page
			.getByRole('link', { name: /Full Body A\b/ })
			.first()
			.getByText('In library')
	).toBeVisible();
});

test('a matching exercise of your own is used instead of a duplicate', async ({ page }) => {
	// "Dumbbell Goblet Squat" is one of the catalog Goblet Squat's aliases.
	await writeDoc(`users/${UID}/workouts/mine`, {
		id: 'mine',
		name: 'Dumbbell Goblet Squat',
		sets: [],
		createdAt: 1
	});
	await signIn(page);
	await page.goto('/discover/routines/full-body-a');

	const match = page.getByRole('group', { name: 'Match for Goblet Squat' });
	await match.getByRole('button', { name: 'Use mine' }).click();
	await page.getByRole('button', { name: 'Add to Library' }).click();

	await expect.poll(async () => (await routines()).length).toBe(1);
	const [routine] = await routines();
	expect(routine.exercises?.[0]?.workoutId).toBe('mine');
	const names = (await workouts()).map((w) => w.name);
	expect(names).not.toContain('Goblet Squat');
	expect(names).toHaveLength(5); // yours + the other four
});

test("an active program offers the day's workout", async ({ page }) => {
	// Full Body Beginner trains Mon/Wed/Fri: Monday is Full Body A.
	await fixWeekday(page, 1);
	await signIn(page);
	await page.goto('/discover/programs/full-body-beginner');
	await page.getByRole('checkbox', { name: /Make it my active program/ }).uncheck();
	await page.getByRole('button', { name: 'Add to Library' }).click();
	await expect.poll(async () => (await programs()).length).toBe(1);
	const [program] = await programs();
	expect((await readDoc(`users/${UID}`))?.activeProgramId ?? null).toBeNull();

	// Set it active from its own page.
	await page.goto(`/programs/${program.id}`);
	await page.getByRole('button', { name: 'Set as active' }).click();
	await expect(page.getByText('Active Program')).toBeVisible();
	await expect.poll(async () => (await readDoc(`users/${UID}`))?.activeProgramId).toBe(program.id);

	// Home offers Monday's session, and starting it opens Full Body A.
	await openTab(page, 'Home');
	const card = page
		.locator('div')
		.filter({ hasText: /^ACTIVE PROGRAM|Full Body Beginner/i })
		.filter({
			has: page.getByRole('button', { name: 'Start', exact: true })
		});
	await card.last().getByRole('button', { name: 'Start', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Goblet Squat' })).toBeVisible();
});

test('an active program shows a rest day when nothing is scheduled', async ({ page }) => {
	// Tuesday: nothing scheduled in Full Body Beginner.
	await fixWeekday(page, 2);
	await signIn(page);
	await page.goto('/discover/programs/full-body-beginner');
	await page.getByRole('button', { name: 'Add to Library' }).click();
	await expect.poll(async () => (await readDoc(`users/${UID}`))?.activeProgramId).toBeTruthy();

	await openTab(page, 'Home');
	await expect(page.getByText('Rest day').first()).toBeVisible();
});
