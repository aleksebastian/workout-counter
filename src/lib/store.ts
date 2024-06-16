import { writable, type Writable } from 'svelte/store';

export type Set = {
	id: string;
	date: string;
	reps: number;
};

export type Workout = {
	id: string;
	name: string;
	sets: Set[];
};

// export const workouts$: Writable<Workout[]> = writable([]);
export const isMobileDevice$: Writable<boolean> = writable(false);
