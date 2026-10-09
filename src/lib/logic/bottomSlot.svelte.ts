import { page } from '$app/state';
import { restTimer } from '$lib/logic/restTimer.svelte';
import { training } from '$lib/logic/training.svelte';
import { isRunPath } from '$lib/routes';

/**
 * One slot sits above the bottom nav, and several things want it. In order:
 * the rest countdown, the offer to turn the rest timer on, then the
 * workout-in-progress bar. Anything that must stay clear of the slot (the
 * FAB, page padding, banners) asks here rather than each bar.
 *
 * The run screen has no bottom nav: it shows rest in its own footer, in
 * place of the Up next card, so the slot stays empty there.
 */
export const bottomSlot = {
	/** The rest countdown or the offer to turn the timer on, away from the run screen. */
	get showsRest() {
		return restTimer.barVisible && !isRunPath(page.url.pathname);
	},

	/** A workout is running, you're not on its screen, and nothing more urgent has the slot. */
	get showsWorkout() {
		return training.session !== null && !isRunPath(page.url.pathname) && !restTimer.barVisible;
	},

	get occupied() {
		return this.showsRest || this.showsWorkout;
	}
};
