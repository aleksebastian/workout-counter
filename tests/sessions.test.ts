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

	// An empty day is a rest day, with planning it one tap away.
	await expect(page.getByText('Rest day')).toBeVisible();
	await page.getByRole('button', { name: 'Plan a session for Wednesday' }).click();
	await page.getByRole('tab', { name: 'Routines' }).click();
	await page.getByRole('button', { name: new RegExp(`^${ROUTINE.name}, `) }).click();
	await page.getByRole('button', { name: /^Add 1 / }).click();
	await expect(page.getByRole('button', { name: `Start ${ROUTINE.name}` })).toBeVisible();

	// The time of day and more sessions are edits.
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await expect(page.getByRole('button', { name: 'When: Anytime. Change' })).toBeVisible();
	await page.getByRole('button', { name: 'Add another session' }).click();
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

test("a program's other days show their plan, and Edit changes it in place", async ({ page }) => {
	const [, press] = EXERCISES;
	const FRI = 5;
	// A set of the press logged today must not tick off Friday's press.
	const today = new Date();
	today.setHours(9, 0, 0, 0);
	today.setDate(today.getDate() - ((today.getDay() - WED + 7) % 7));
	await writeDoc(`users/${UID}/workouts/${press.id}`, {
		...press,
		sets: [{ id: 'set-today', date: today.toISOString(), reps: 8 }],
		createdAt: 2
	});
	const press3 = { type: 'exercise', workoutId: press.id, targetSets: 3 };
	await writeDoc(`users/${UID}/programs/${PROGRAM.id}`, {
		...PROGRAM,
		schedule: [
			{ day: WED, sessions: [{ id: 'wed', items: [press3] }] },
			{ day: FRI, sessions: [{ id: 'fri', items: [press3] }] }
		],
		createdAt: 1
	});
	await fixWeekday(page, WED);
	await signIn(page);
	await page.goto(`/programs/${PROGRAM.id}`);

	// Today's session is the one in green.
	await expect(page.getByRole('button', { name: `Start ${press.name}` })).toBeVisible();

	await page.getByRole('button', { name: 'Friday: planned' }).click();
	const friday = page.getByRole('region', { name: 'Friday' });
	await expect(friday.getByText('3 sets', { exact: true })).toBeVisible();
	await expect(friday.getByText('Done')).toHaveCount(0);
	await expect(friday.getByRole('button', { name: 'Start now' })).toBeVisible();

	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await page.getByRole('button', { name: `More sets of ${press.name}` }).click();
	await expect
		.poll(async () => (await readDoc(`users/${UID}/programs/${PROGRAM.id}`))?.schedule[1])
		.toEqual({ day: FRI, sessions: [{ id: 'fri', items: [{ ...press3, targetSets: 4 }] }] });
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(friday.getByText('4 sets', { exact: true })).toBeVisible();
});

test('a done session offers another go, and one ended early resumes', async ({ page }) => {
	const [, press] = EXERCISES;
	await seedProgram([
		{
			id: 'am',
			slot: 'morning',
			items: [{ type: 'exercise', workoutId: press.id, targetSets: 1 }]
		},
		{ id: 'pm', slot: 'evening', items: [{ type: 'routine', routineId: ROUTINE.id }] }
	]);
	const at = new Date();
	at.setHours(8, 0, 0, 0);
	at.setDate(at.getDate() - ((at.getDay() - WED + 7) % 7));
	const source = (sessionId: string) => ({
		type: 'program',
		programId: PROGRAM.id,
		day: WED,
		sessionId
	});
	const log = (id: string, sessionId: string, complete: boolean, startedAt: number) => ({
		id,
		source: source(sessionId),
		name: id,
		startedAt,
		endedAt: startedAt + 20 * 60_000,
		endReason: 'finished',
		complete,
		exercises: [],
		totals: { sets: complete ? 1 : 2, reps: 10 },
		createdAt: startedAt
	});
	await writeDoc(`users/${UID}/sessions/done`, log('done', 'am', true, at.getTime()));
	await writeDoc(`users/${UID}/sessions/early`, log('early', 'pm', false, at.getTime() + 3600_000));
	const user = await readDoc(`users/${UID}`);
	await writeDoc(`users/${UID}`, {
		...user,
		lastSession: {
			id: 'early',
			source: source('pm'),
			name: ROUTINE.name,
			startedAt: at.getTime() + 3600_000,
			endedAt: at.getTime() + 3600_000 + 20 * 60_000,
			currentWorkoutId: null,
			currentIndex: 0,
			pausedMs: 0,
			complete: false
		}
	});
	await fixWeekday(page, WED);
	await signIn(page);
	await page.goto(`/programs/${PROGRAM.id}`);

	await expect(page.getByRole('link', { name: `${press.name}: done` })).toBeVisible();
	await expect(page.getByRole('button', { name: `Do ${press.name} again` })).toBeVisible();
	const evening = page.getByRole('region', { name: `${ROUTINE.name} session` });
	await expect(evening.getByText('Evening · Ended early')).toBeVisible();
	await evening.getByRole('button', { name: 'Resume' }).click();
	// Resuming carries on the same workout rather than starting a new one.
	await expect.poll(async () => (await readDoc(`users/${UID}`))?.activeSession?.id).toBe('early');
});
