import {
	EXERCISES,
	ROUTINE,
	UID,
	expect,
	fixWeekday,
	listDocs,
	openTab,
	readDoc,
	signIn,
	storedSets,
	test,
	writeDoc
} from './fixtures';

/** Wednesday: the tests pin the clock to 10:00 that day, in the Morning slot. */
const WED = 3;
const PROGRAM = { id: 'program-e2e', name: 'E2E Week' };

async function seedProgram(sessions: Record<string, unknown>[]) {
	await writeDoc(`users/${UID}/programs/${PROGRAM.id}`, {
		...PROGRAM,
		schedule: sessions.length ? [{ day: WED, sessions }] : [],
		createdAt: 1
	});
	const user = await readDoc(`users/${UID}`);
	await writeDoc(`users/${UID}`, { ...user, activeProgramId: PROGRAM.id });
}

test('a day of two sessions moves on to the next once the first is done', async ({ page }) => {
	const [, press] = EXERCISES;
	await seedProgram([
		{ id: 'pm', slot: 'evening', items: [{ type: 'routine', routineId: ROUTINE.id }] },
		{ id: 'am', slot: 'morning', items: [{ type: 'exercise', workoutId: press.id, targetSets: 1 }] }
	]);
	await fixWeekday(page, WED);
	await signIn(page);
	await openTab(page, 'Today');

	const plan = page.getByRole('region', { name: "Today's plan" });
	await expect(plan.getByText('0 of 2 done')).toBeVisible();
	await expect(plan.getByText('Morning · Up next')).toBeVisible();
	await expect(page.getByRole('listitem', { name: 'Today: 0 of 2 sessions done' })).toBeVisible();

	// The morning session runs on its own and is named for its one exercise.
	await plan.getByRole('button', { name: `Start ${press.name}`, exact: true }).click();
	await expect(page.getByRole('heading', { name: press.name })).toBeVisible();
	await expect(page.getByText(/Morning · \d+:\d{2} elapsed/).first()).toBeVisible();
	await page
		.getByRole('button', { name: /^Log set \d/ })
		.last()
		.click();
	await expect.poll(async () => (await storedSets(press.id)).length).toBe(1);
	await page.getByRole('button', { name: 'Finish', exact: true }).first().click();
	await expect(page.getByText('Workout complete')).toBeVisible();
	await expect
		.poll(async () => (await listDocs(`users/${UID}/sessions`)) as Record<string, unknown>[])
		.toEqual([
			expect.objectContaining({
				name: press.name,
				complete: true,
				slot: 'morning',
				source: { type: 'program', programId: PROGRAM.id, day: WED, sessionId: 'am' }
			})
		]);
	await page.getByRole('button', { name: 'Done', exact: true }).click();

	// Back on Today the evening session is up next, and the ring is half full.
	await expect(plan.getByText('1 of 2 done')).toBeVisible();
	await expect(plan.getByText('Evening · Up next')).toBeVisible();
	await expect(page.getByRole('listitem', { name: 'Today: 1 of 2 sessions done' })).toBeVisible();
});

test('a session is added to a day at a time of its own', async ({ page }) => {
	const [, press] = EXERCISES;
	await seedProgram([]);
	await fixWeekday(page, WED);
	await signIn(page);
	await page.goto(`/programs/${PROGRAM.id}`);

	await page.getByRole('button', { name: 'Add to Wed' }).click();
	await page.getByRole('tab', { name: 'Routines' }).click();
	await page.getByRole('button', { name: new RegExp(`^${ROUTINE.name}, `) }).click();
	await page.getByRole('button', { name: /^Add 1 / }).click();
	await expect(page.getByRole('button', { name: 'When: Anytime. Change' })).toBeVisible();

	await page.getByRole('button', { name: 'Add session' }).click();
	await page.getByRole('button', { name: /^Night/ }).click();
	await page.getByRole('button', { name: new RegExp(`^${press.name}, `) }).click();
	await page.getByRole('button', { name: /^Add 1 / }).click();

	await expect
		.poll(async () => (await readDoc(`users/${UID}/programs/${PROGRAM.id}`))?.schedule)
		.toEqual([
			{
				day: WED,
				// Saved in the order they're shown: by slot, the untimed one last.
				sessions: [
					{
						id: expect.any(String),
						slot: 'night',
						items: [{ type: 'exercise', workoutId: press.id, targetSets: 3 }]
					},
					{ id: expect.any(String), items: [{ type: 'routine', routineId: ROUTINE.id }] }
				]
			}
		]);

	// Today lists both, the untimed one last.
	await openTab(page, 'Today');
	const plan = page.getByRole('region', { name: "Today's plan" });
	await expect(plan.getByText('Night · Up next')).toBeVisible();
	await expect(plan.getByText('Anytime')).toBeVisible();
});
