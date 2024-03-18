export const ssr = false;

import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { get } from 'svelte/store';
import { workouts$ } from '$lib/store';
import { browser } from '$app/environment';

export const load: PageLoad = ({ params }) => {
	const { workoutId } = params;
	let workouts = get(workouts$);

	if (browser && !workouts.length) {
		const localStorageWorkouts = localStorage.getItem('workouts');
		const parsedLocalStorageWorkouts = localStorageWorkouts ? JSON.parse(localStorageWorkouts) : [];
		if (parsedLocalStorageWorkouts.length) {
			workouts = parsedLocalStorageWorkouts;
		}
	}

	const workout = workouts.find((workout) => workout.id === workoutId);

	if (!workout) {
		error(404, 'Not found');
	}

	return {
		props: {
			workoutId
		}
	};
};
