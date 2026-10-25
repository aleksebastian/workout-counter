import { describe, it, expect } from 'vitest';
import { pastTarget, pauseTimer, resumeTimer, startTimer, timerSeconds } from './setTimer';

const T = 1_000_000;
const s = (n: number) => n * 1000;

describe('set timer', () => {
	it('counts from the clock, so a closed app loses nothing', () => {
		const timer = startTimer('bike', T);
		expect(timerSeconds(timer, T + s(90))).toBe(90);
		expect(timerSeconds(timer, T + s(41 * 60 + 20))).toBe(41 * 60 + 20);
	});

	it('stops counting while paused and leaves the pause out once resumed', () => {
		const paused = pauseTimer(startTimer('bike', T), T + s(60));
		expect(timerSeconds(paused, T + s(300))).toBe(60);
		const resumed = resumeTimer(paused, T + s(300));
		expect(resumed.pausedAt).toBeUndefined();
		expect(timerSeconds(resumed, T + s(330))).toBe(90);
	});

	it('ignores a second pause or a resume that isn’t paused', () => {
		const paused = pauseTimer(startTimer('bike', T), T + s(10));
		expect(pauseTimer(paused, T + s(20))).toBe(paused);
		const running = startTimer('bike', T);
		expect(resumeTimer(running, T + s(20))).toBe(running);
	});

	it('asks about the target only once a running timer has gone past it', () => {
		const timer = startTimer('bike', T);
		expect(pastTarget(timer, 1800, T + s(1799))).toBe(false);
		expect(pastTarget(timer, 1800, T + s(1801))).toBe(true);
		expect(pastTarget(timer, undefined, T + s(5000))).toBe(false);
		expect(pastTarget(pauseTimer(timer, T + s(1900)), 1800, T + s(2000))).toBe(false);
	});
});
