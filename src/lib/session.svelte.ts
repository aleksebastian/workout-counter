import type { User } from 'firebase/auth';
import { browser } from '$app/environment';
import { user, userData, workouts, routines, programs, storeErrors } from '$lib/firebase';
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

// `undefined` = not resolved yet, `null` = resolved to nothing. Both the auth
// user and the profile document use that convention, so "still loading" is
// never confused with "signed out" / "no profile".
let authUser = $state<User | null | undefined>(undefined);
let data = $state<UserData | null | undefined>(undefined);
let workoutList = $state<Workout[] | null>(null);
let routineList = $state<Routine[] | null>(null);
let programList = $state<Program[] | null>(null);
let firstError = $state<string | null>(null);

if (browser) {
	user.subscribe((v) => (authUser = v));
	userData.subscribe((v) => (data = v));
	workouts.subscribe((v) => (workoutList = v));
	routines.subscribe((v) => (routineList = v));
	programs.subscribe((v) => (programList = v));
	storeErrors.subscribe((all) => (firstError = Object.values(all)[0] ?? null));
}

/** `loading` until Firebase has resolved auth; `onboarding` until a username exists. */
export type SessionStatus = 'loading' | 'signed-out' | 'onboarding' | 'ready' | 'error';

export const session = {
	get user() {
		return authUser ?? null;
	},
	get uid() {
		return authUser?.uid ?? null;
	},
	get data() {
		return data ?? null;
	},

	get status(): SessionStatus {
		if (authUser === undefined) return 'loading'; // auth not resolved
		if (authUser === null) return 'signed-out';
		if (firstError) return 'error'; // a listener died; nothing will arrive
		if (data === undefined) return 'loading'; // profile snapshot not delivered
		// A delivered `null` means the document is confirmed absent — a brand-new
		// account that still needs to claim a username. Treating that as `loading`
		// is what used to leave new accounts on a skeleton forever.
		return data?.username ? 'ready' : 'onboarding';
	},

	/** Message from the first failed snapshot listener, if any. */
	get error() {
		return firstError;
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
