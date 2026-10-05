import { page } from '$app/state';
import { restTimer } from '$lib/logic/restTimer.svelte';
import { training } from '$lib/logic/training.svelte';

/**
 * One slot sits above the bottom nav, and several things want it. In order:
 * the rest countdown, the offer to turn the rest timer on, then the
 * workout-in-progress bar. Anything that must stay clear of the slot (the
 * FAB, page padding, banners) asks here rather than each bar.
 */
export const bottomSlot = {
	/** A workout is running, you're not on its screen, and nothing more urgent has the slot. */
	get showsWorkout() {
		return (
			training.session !== null &&
			!page.url.pathname.startsWith('/train/run') &&
			!restTimer.barVisible
		);
	},

	get occupied() {
		return restTimer.barVisible || this.showsWorkout;
	}
};
