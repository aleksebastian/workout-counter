import type { SetTimer } from '$lib/types';

/**
 * The stopwatch for a time or distance set, as plain data: started, paused
 * and resumed by timestamps, so what it shows is always worked out from the
 * clock. Nothing ticks in the background — a closed app loses no time.
 */

export function startTimer(workoutId: string, now: number): SetTimer {
	return { workoutId, startedAt: now, pausedMs: 0 };
}

export function pauseTimer(timer: SetTimer, now: number): SetTimer {
	return timer.pausedAt === undefined ? { ...timer, pausedAt: now } : timer;
}

export function resumeTimer(timer: SetTimer, now: number): SetTimer {
	if (timer.pausedAt === undefined) return timer;
	const { pausedAt, ...rest } = timer;
	return { ...rest, pausedMs: timer.pausedMs + Math.max(0, now - pausedAt) };
}

/** Whole seconds on the clock: since the start, less any pause. */
export function timerSeconds(timer: SetTimer, now: number): number {
	const end = timer.pausedAt ?? now;
	return Math.max(0, Math.floor((end - timer.startedAt - timer.pausedMs) / 1000));
}

/**
 * Came back to a running timer that has gone past its target: the moment to
 * ask whether to log the target or the time it actually ran. Never while
 * paused, and never without a target.
 */
export function pastTarget(timer: SetTimer, targetSeconds: number | undefined, now: number) {
	return (
		timer.pausedAt === undefined && !!targetSeconds && timerSeconds(timer, now) > targetSeconds
	);
}
