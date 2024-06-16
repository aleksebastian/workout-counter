import type { User } from 'firebase/auth';
import type { Workout } from './store';

export function getUserInitials(user: User) {
	if (user) {
		const name = user.displayName;
		const initials = name
			?.split(' ')
			.map((n) => n[0])
			.join('');

		return initials;
	}
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
