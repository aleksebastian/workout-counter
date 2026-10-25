import { sameSource } from '$lib/logic/training';
import {
	currentSlot,
	sessionsForDay,
	slotRank,
	type ActiveSession,
	type Program,
	type ProgramSession,
	type SessionLog,
	type SessionSource
} from '$lib/types';

/**
 * Today's sessions from the active program and where each stands, kept free
 * of the session store so the rules can be tested on their own.
 */

export type PlanRow = {
	session: ProgramSession;
	source: Extract<SessionSource, { type: 'program' }>;
	/**
	 * `done`: a workout today got every planned exercise's sets. `partial`: one
	 * ended early. `live`: it's running now. `todo`: not started today.
	 */
	status: 'done' | 'partial' | 'live' | 'todo';
	/** The one session to offer next: there's at most one, and none while a workout runs. */
	upNext: boolean;
	/** Its slot has already gone by, e.g. a Morning session still to do in the evening. */
	past: boolean;
	/** Today's latest workout of it, if any. */
	log: SessionLog | null;
};

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/**
 * Today's sessions in slot order. Up next is the first one not yet done whose
 * slot is now or later; failing that (everything left has gone by), the first
 * one not yet done. Sessions without a slot count as later than any.
 */
export function todayPlan(
	program: Program,
	day: number,
	logs: SessionLog[],
	active: ActiveSession | null,
	now: number
): PlanRow[] {
	const nowRank = slotRank(currentSlot(new Date(now)));
	const rows: PlanRow[] = sessionsForDay(program, day).map((session) => {
		const source = { type: 'program', programId: program.id, day, sessionId: session.id } as const;
		const today = logs.filter((l) => sameSource(l.source, source) && sameDay(l.endedAt, now));
		const live = !!active && sameSource(active.source, source);
		return {
			session,
			source,
			status: live
				? 'live'
				: today.some((l) => l.complete)
					? 'done'
					: today.length
						? 'partial'
						: 'todo',
			upNext: false,
			past: slotRank(session.slot) < nowRank,
			log: today.reduce<SessionLog | null>((a, l) => (!a || l.endedAt > a.endedAt ? l : a), null)
		};
	});
	if (!active) {
		const open = rows.filter((r) => r.status === 'todo' || r.status === 'partial');
		const next = open.find((r) => !r.past) ?? open[0];
		if (next) next.upNext = true;
	}
	return rows;
}
