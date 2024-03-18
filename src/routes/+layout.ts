export const ssr = false;

import type { LayoutLoad } from './$types';
import { workouts$, isMobileDevice$ } from '$lib/store';

export const load: LayoutLoad = () => {
	isMobileDevice$.set(window.navigator.userAgent.toLowerCase().includes('mobi'));

	const localStorageWorkouts = localStorage.getItem('workouts');
	if (localStorageWorkouts) {
		workouts$.set(JSON.parse(localStorageWorkouts));
	}

	return {
		props: {}
	};
};
