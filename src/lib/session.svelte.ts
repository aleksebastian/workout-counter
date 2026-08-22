import type { User } from 'firebase/auth';
import { browser } from '$app/environment';
import { user, userData, workouts, routines, programs } from '$lib/firebase';
import { DEFAULT_PREFERENCES } from '$lib/constants';
import type { Preferences, Program, Routine, UserData, Workout } from '$lib/types';

/**
 * Rune-backed mirror of the Firebase stores.
 *
 * The stores themselves stay as the Firebase integration point; this module is
 * the single place the rest of the app reads them from, so pages get plain
 * property access (`session.prefs.weightUnit`) instead of repeating
 * `$userData?.preferences?.weightUnit ?? 'lbs'` and its defaults everywhere.
 */

let authUser = $state<User | null | undefined>(undefined);
let data = $state<UserData | null>(null);
let workoutList = $state<Workout[] | null>(null);
let routineList = $state<Routine[] | null>(null);
let programList = $state<Program[] | null>(null);

if (browser) {
	user.subscribe((v) => (authUser = v));
	userData.subscribe((v) => (data = v));
	workouts.subscribe((v) => (workoutList = v));
	routines.subscribe((v) => (routineList = v));
	programs.subscribe((v) => (programList = v));
}

/** `loading` until Firebase has resolved auth; `onboarding` until a username exists. */
export type SessionStatus = 'loading' | 'signed-out' | 'onboarding' | 'ready';

export const session = {
	get user() {
		return authUser ?? null;
	},
	get uid() {
		return authUser?.uid ?? null;
	},
	get data() {
		return data;
	},

	get status(): SessionStatus {
		if (authUser === undefined) return 'loading';
		if (authUser === null) return 'signed-out';
		if (!data) return 'loading';
		return data.username ? 'ready' : 'onboarding';
	},

	/** True once the user is signed in and past onboarding — gates app chrome. */
	get ready() {
		return this.status === 'ready';
	},

	/** Preferences with defaults applied, so callers never handle `undefined`. */
	get prefs(): Preferences {
		const stored = data?.preferences;
		return {
			...DEFAULT_PREFERENCES,
			...stored,
			timer: { ...DEFAULT_PREFERENCES.timer, ...stored?.timer }
		};
	},

	get activeProgramId() {
		return data?.activeProgramId ?? null;
	},

	// ── Collections ───────────────────────────────────────────────────────────
	// `null` means "not loaded yet"; an empty array means "loaded and empty".
	get workouts() {
		return workoutList;
	},
	get routines() {
		return routineList;
	},
	get programs() {
		return programList;
	},

	workout(id: string | undefined) {
		return id ? (workoutList?.find((w) => w.id === id) ?? null) : null;
	},
	routine(id: string | undefined) {
		return id ? (routineList?.find((r) => r.id === id) ?? null) : null;
	},
	program(id: string | undefined) {
		return id ? (programList?.find((p) => p.id === id) ?? null) : null;
	},
	get activeProgram() {
		return this.program(this.activeProgramId ?? undefined);
	}
};
