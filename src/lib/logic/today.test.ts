import { describe, it, expect } from 'vitest';
import { todayPlan } from './today';
import type { ActiveSession, Program, SessionLog } from '$lib/types';

const item = { type: 'routine', routineId: 'r' } as const;
const program: Program = {
	id: 'p',
	name: 'Week',
	schedule: [
		{
			day: 6,
			sessions: [
				{ id: 'night', slot: 'night', items: [item] },
				{ id: 'am', slot: 'morning', items: [item] },
				{ id: 'pm', slot: 'evening', items: [item] }
			]
		}
	],
	createdAt: 0
};

/** Saturday 24 October 2026 at the given hour, local time. */
const at = (h: number) => new Date(2026, 9, 24, h).getTime();

function log(sessionId: string, endedAt: number, complete = true): SessionLog {
	return {
		id: `log-${sessionId}-${endedAt}`,
		source: { type: 'program', programId: 'p', day: 6, sessionId },
		name: sessionId,
		startedAt: endedAt - 30 * 60_000,
		endedAt,
		endReason: 'finished',
		complete,
		exercises: [],
		totals: { sets: 3, reps: 30 },
		createdAt: endedAt
	};
}

const summary = (rows: ReturnType<typeof todayPlan>) =>
	rows.map((r) => `${r.session.id}:${r.status}${r.upNext ? '*' : ''}`);

describe('todayPlan', () => {
	it('lists the day in slot order with the current slot up next', () => {
		expect(summary(todayPlan(program, 6, [], null, at(7)))).toEqual([
			'am:todo*',
			'pm:todo',
			'night:todo'
		]);
	});

	it('moves on once a session is done', () => {
		const rows = todayPlan(program, 6, [log('am', at(8))], null, at(18));
		expect(summary(rows)).toEqual(['am:done', 'pm:todo*', 'night:todo']);
		expect(rows[0].log?.id).toBe(`log-am-${at(8)}`);
	});

	it('skips a session whose slot has gone by, but still offers it last', () => {
		expect(summary(todayPlan(program, 6, [], null, at(19)))).toEqual([
			'am:todo',
			'pm:todo*',
			'night:todo'
		]);
		const lateNight = todayPlan(program, 6, [log('night', at(22))], null, at(23));
		expect(summary(lateNight)).toEqual(['am:todo*', 'pm:todo', 'night:done']);
		expect(lateNight[0].past).toBe(true);
	});

	it('marks a session that ended early as partial, still to finish', () => {
		expect(summary(todayPlan(program, 6, [log('pm', at(18), false)], null, at(19)))).toEqual([
			'am:todo',
			'pm:partial*',
			'night:todo'
		]);
	});

	it('ignores workouts from other days', () => {
		const yesterday = new Date(2026, 9, 23, 8).getTime();
		expect(todayPlan(program, 6, [log('am', yesterday)], null, at(7))[0].status).toBe('todo');
	});

	it('offers nothing while a workout runs', () => {
		const active = {
			id: 'a',
			source: { type: 'program', programId: 'p', day: 6, sessionId: 'pm' },
			name: 'pm',
			startedAt: at(18),
			lastActiveAt: at(18),
			currentWorkoutId: null,
			currentIndex: 0,
			pausedMs: 0
		} satisfies ActiveSession;
		expect(summary(todayPlan(program, 6, [], active, at(18)))).toEqual([
			'am:todo',
			'pm:live',
			'night:todo'
		]);
	});

	it('offers nothing once every session is done', () => {
		const logs = [log('am', at(8)), log('pm', at(18)), log('night', at(22))];
		expect(todayPlan(program, 6, logs, null, at(23)).some((r) => r.upNext)).toBe(false);
	});
});
