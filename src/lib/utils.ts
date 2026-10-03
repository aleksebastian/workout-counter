import type { User } from 'firebase/auth';
import type { Workout, Routine, Program } from './types';

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

	if (!name.trim().length) {
		result = 'Workout name missing';
	} else if (workouts.some((workout) => workout.name.toLowerCase() === name.trim().toLowerCase())) {
		result = 'Workout already exists';
	}

	return result;
}

export function getRoutineNameValidationMsg(name: string, routines: Routine[] | undefined) {
	if (!name.trim().length) return 'Routine name missing';
	if (routines?.some((r) => r.name.toLowerCase() === name.trim().toLowerCase())) {
		return 'Routine already exists';
	}
	return undefined;
}

export function getProgramNameValidationMsg(name: string, programs: Program[] | undefined) {
	if (!name.trim().length) return 'Program name missing';
	if (programs?.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
		return 'Program already exists';
	}
	return undefined;
}

/**
 * Converts a URL-safe base64 string to a Uint8Array.
 * Required by pushManager.subscribe({ applicationServerKey }) which expects
 * the VAPID public key as a Uint8Array, not a string.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	const buffer = new ArrayBuffer(rawData.length);
	const view = new Uint8Array(buffer);
	for (let i = 0; i < rawData.length; i++) {
		view[i] = rawData.charCodeAt(i);
	}
	return view;
}
