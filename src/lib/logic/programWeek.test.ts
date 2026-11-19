import { describe, it, expect } from 'vitest';
import {
	chipLabel,
	eyebrow,
	itemDetail,
	keyed,
	presentExercises,
	sessionViews,
	programSummary,
	startButton,
	takenSlots,
	withSessions,
	type SessionView
} from './programWeek';
import type { Lookups } from './training';
import type { PlanRow } from './today';
import type {
	Preferences,
	Program,
	ProgramDay,
	ProgramItem,
	Routine,
	SessionLog,
	Workout
} from '$lib/types';

const workout = (id: string, extra: Partial<Workout> = {}): Workout => ({
	id,
	name: id.toUpperCase(),
	sets: [],
	createdAt: 0,
	...extra
});
const routine = (id: string, workoutIds: string[]): Routine => ({
	id,
	name: `Routine ${id}`,
	exercises: workoutIds.map((workoutId) => ({ workoutId, targetSets: 3 })),
	createdAt: 0
});

const workouts = [workout('squat'), workout('plank', { measure: 'time' }), workout('bench')];
const routines = [routine('push', ['bench', 'squat'])];
const lookups: Lookups = {
	routine: (id) => routines.find((r) => r.id === id) ?? null,
	program: () => null,
	workout: (id) => workouts.find((w) => w.id === id) ?? null
};

const squat: ProgramItem = { type: 'exercise', workoutId: 'squat', targetSets: 3 };
const push: ProgramItem = { type: 'routine', routineId: 'push' };

function view(row: Partial<PlanRow> | null, extra: Partial<SessionView> = {}): SessionView {
	const session = { id: 's', slot: 'morning' as const, items: [push] };
	return {
		session,
		source: { type: 'program', programId: 'p', day: 1, sessionId: 's' },
		plan: [],
		title: 'Push',
		routineId: 'push',
		meta: '',
		row: row && {
			session,
			source: { type: 'program', programId: 'p', day: 1, sessionId: 's' },
			status: 'todo',
			upNext: false,
			past: false,
			log: null,
			...row
		},
		done: [],
		doneLog: null,
		resumable: false,
		...extra
	};
}

describe('programSummary', () => {
	const program = (schedule: ProgramDay[]): Program => ({
		id: 'p',
		name: 'P',
		schedule,
		createdAt: 0
	});

	it('says when nothing is planned', () => {
		expect(programSummary(program([]))).toBe('nothing planned yet');
	});

	it('counts days, and sessions only when a day has more than one', () => {
		const one = { id: 'a', items: [squat] };
		expect(programSummary(program([{ day: 1, sessions: [one] }]))).toBe('1 day a week');
		expect(
			programSummary(
				program([
					{ day: 1, sessions: [one, { id: 'b', slot: 'evening', items: [push] }] },
					{ day: 3, sessions: [one, { id: 'c', items: [] }] }
				])
			)
		).toBe('2 days a week · 3 sessions');
	});
});

describe('eyebrow and startButton', () => {
	it('shows the slot only when the day has several sessions', () => {
		expect(eyebrow(view(null), 1)).toBe('');
		expect(eyebrow(view(null), 2)).toBe('Morning');
		expect(eyebrow(view({ status: 'todo', upNext: true }), 2)).toBe('Morning · Up next');
		expect(eyebrow(view({ status: 'live' }), 1)).toBe('In progress');
		expect(eyebrow(view({ status: 'partial' }), 1)).toBe('Ended early');
	});

	it('is green only for what to do now', () => {
		expect(startButton(view({ status: 'live' }), true)).toEqual({
			label: 'Continue',
			primary: true
		});
		expect(
			startButton(view({ status: 'partial', upNext: true }, { resumable: true }), true)
		).toEqual({ label: 'Resume', primary: true });
		expect(startButton(view({ status: 'partial' }), true)).toEqual({
			label: 'Start again',
			primary: false
		});
		expect(startButton(view({ status: 'todo', upNext: true }), true)).toEqual({
			label: 'Start Push',
			primary: true
		});
		expect(startButton(view(null), true)).toEqual({ label: 'Start', primary: false });
		expect(startButton(view(null), false)).toEqual({ label: 'Start now', primary: false });
	});
});

describe('editing helpers', () => {
	it('invites setting a time only on a lone session without one', () => {
		expect(chipLabel({ id: 'a', items: [] }, false)).toBe('Set a time');
		expect(chipLabel({ id: 'a', items: [] }, true)).toBe('Anytime');
		expect(chipLabel({ id: 'a', slot: 'evening', items: [] }, false)).toBe('Evening');
	});

	it('keys repeats of the same item apart', () => {
		expect(keyed([squat, push, squat]).map((k) => k.key)).toEqual([
			'w:squat#0',
			'r:push#0',
			'w:squat#1'
		]);
	});

	it('details a routine and a non-rep exercise', () => {
		expect(itemDetail(push, lookups, 'km')).toBe('Routine · 2 exercises');
		expect(itemDetail(squat, lookups, 'km')).toBeNull();
		expect(
			itemDetail(
				{ type: 'exercise', workoutId: 'plank', targetSets: 3, targetSeconds: 60 },
				lookups,
				'km'
			)
		).toBe('1 min');
	});

	it('lists direct exercises first, then those a routine brings', () => {
		expect(presentExercises([push, squat], lookups)).toEqual([
			{ workoutId: 'squat', removable: true },
			{ workoutId: 'bench', removable: false, note: 'In Routine push' }
		]);
	});

	it('says what each slot holds, leaving out the session being moved', () => {
		const sessions = [
			{ id: 'a', slot: 'morning' as const, items: [push] },
			{ id: 'b', items: [squat] },
			{ id: 'c', slot: 'evening' as const, items: [] }
		];
		expect(takenSlots(sessions, null, lookups)).toEqual({
			morning: 'Has Routine push',
			anytime: 'Has SQUAT'
		});
		expect(takenSlots(sessions, 'a', lookups)).toEqual({ anytime: 'Has SQUAT' });
	});

	it('replaces, adds in order, and drops a day', () => {
		const schedule: ProgramDay[] = [
			{ day: 1, sessions: [{ id: 'a', items: [squat] }] },
			{ day: 5, sessions: [{ id: 'b', items: [push] }] }
		];
		const next = [{ id: 'c', items: [push] }];
		expect(withSessions(schedule, 3, next).map((d) => d.day)).toEqual([1, 3, 5]);
		expect(withSessions(schedule, 1, next)[0].sessions).toBe(next);
		expect(withSessions(schedule, 5, [])).toEqual([schedule[0]]);
	});
});

describe('sessionViews', () => {
	const noon = new Date(2026, 9, 24, 12).getTime();
	const prefs = { timerEnabled: false, distanceUnit: 'km' } as Preferences;
	const sessions = [
		{ id: 'a', slot: 'morning' as const, items: [push] },
		{ id: 'b', items: [squat] },
		{ id: 'empty', items: [] }
	];
	const source = (sessionId: string) =>
		({ type: 'program', programId: 'p', day: 6, sessionId }) as const;
	const row = (id: string, status: PlanRow['status'], log: SessionLog | null = null): PlanRow => ({
		session: sessions.find((s) => s.id === id)!,
		source: source(id),
		status,
		upNext: false,
		past: false,
		log
	});
	const finished = (sessionId: string, endedAt: number, complete = true): SessionLog => ({
		id: `log-${sessionId}-${endedAt}`,
		source: source(sessionId),
		name: sessionId,
		startedAt: endedAt - 30 * 60_000,
		endedAt,
		endReason: 'finished',
		complete,
		exercises: [],
		totals: { sets: 3, reps: 30 },
		createdAt: endedAt
	});
	const week: Program = { id: 'p', name: 'P', schedule: [{ day: 6, sessions }], createdAt: 0 };
	const ctx = (extra: Partial<Parameters<typeof sessionViews>[3]> = {}) => ({
		lookups: { ...lookups, program: (id: string) => (id === 'p' ? week : null) },
		prefs,
		logs: [],
		todayRows: [],
		liveStartedAt: undefined,
		canResume: () => false,
		now: noon,
		...extra
	});

	it('reads each session with something in it', () => {
		const views = sessionViews('p', 6, sessions, ctx());
		expect(views.map((v) => [v.title, v.routineId, v.meta])).toEqual([
			['Routine push', 'push', 'Routine · 2 exercises · 6 sets · about 5 min'],
			['SQUAT', null, '1 exercise · 3 sets · about 5 min']
		]);
		expect(views[0].done).toEqual([]);
		expect(views[0].source).toEqual(source('a'));
	});

	it('ticks entries off for the run under way, from when it started', () => {
		workouts[2].sets = [1, 2, 3].map((n) => ({
			id: `b${n}`,
			date: new Date(noon - n * 60_000).toISOString(),
			reps: 8
		}));
		try {
			const live = sessionViews(
				'p',
				6,
				sessions,
				ctx({ todayRows: [row('a', 'live')], liveStartedAt: noon - 10 * 60_000 })
			);
			expect(live[0].done).toEqual([true, false]);
			const later = sessionViews(
				'p',
				6,
				sessions,
				ctx({ todayRows: [row('a', 'live')], liveStartedAt: noon })
			);
			expect(later[0].done).toEqual([false, false]);
		} finally {
			workouts[2].sets = [];
		}
	});

	it("finds today's finished run, not yesterday's or one ended early", () => {
		const today = finished('a', noon - 60_000);
		const logs = [
			finished('a', noon - 30_000, false),
			finished('a', noon - 24 * 60 * 60_000),
			today
		];
		const [done] = sessionViews('p', 6, sessions, ctx({ logs, todayRows: [row('a', 'done')] }));
		expect(done.doneLog).toBe(today);
		const [other] = sessionViews(
			'p',
			6,
			sessions,
			ctx({ logs: [logs[1]], todayRows: [row('a', 'done')] })
		);
		expect(other.doneLog).toBeNull();
	});

	it('offers to resume only a session that ended early', () => {
		const canResume = () => true;
		const views = sessionViews(
			'p',
			6,
			sessions,
			ctx({ canResume, todayRows: [row('a', 'partial'), row('b', 'todo')] })
		);
		expect(views.map((v) => v.resumable)).toEqual([true, false]);
	});
});
