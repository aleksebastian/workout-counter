import type { User } from 'firebase/auth';
import type { Workout, Routine, Program } from './state.svelte';

export function getUserInitials(user: User) {
	if (user) {
		const name = user.displayName;
		const initials = name
			?.split(' ')
			.map((n) => n[0])
			.join('');

		return initials;
	}
	return '';
}

export function getWorkoutNameValidationMsg(name: string, workouts: Workout[] | undefined) {
	if (!workouts) return;
	let result = undefined;

	if (workouts.some((workout) => workout.name.toLowerCase() === name.toLowerCase())) {
		result = 'Workout already exists';
	} else if (!name.length) {
		result = 'Workout name missing';
	}

	return result;
}

export function getRoutineNameValidationMsg(name: string, routines: Routine[] | undefined) {
	if (!name.length) return 'Routine name missing';
	if (routines?.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
		return 'Routine already exists';
	}
	return undefined;
}

export function getProgramNameValidationMsg(name: string, programs: Program[] | undefined) {
	if (!name.length) return 'Program name missing';
	if (programs?.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
		return 'Program already exists';
	}
	return undefined;
}
