import { initializeApp } from 'firebase/app';
import {
	doc,
	getFirestore,
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
	onSnapshot
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { writable, type Readable, derived } from 'svelte/store';
import type { Workout, Routine, Program } from './state.svelte';

const firebaseConfig = {
	apiKey: 'AIzaSyB2Wxz_yyr7spT7MrwhxpGPK9XXbo8SDmU',
	authDomain: 'workout-counter-99d56.firebaseapp.com',
	projectId: 'workout-counter-99d56',
	storageBucket: 'workout-counter-99d56.appspot.com',
	messagingSenderId: '478354387280',
	appId: '1:478354387280:web:23f072341f031c76ed3c55',
	measurementId: 'G-9KJS0LCCEV'
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Use IndexedDB-backed offline persistence in the browser so onSnapshot
// hydrates immediately from disk on cold starts (before the network responds).
// Falls back to in-memory only on the server (SSR / no IndexedDB available).
export const db =
	typeof window !== 'undefined'
		? initializeFirestore(app, {
				localCache: persistentLocalCache({
					tabManager: persistentMultipleTabManager()
				})
			})
		: getFirestore(app);

export const auth = getAuth();
export const storage = getStorage();

/**
 * @returns a store with the current firebase user
 */
function userStore() {
	let unsubscribe: () => void;

	if (!auth || !globalThis.window) {
		const { subscribe } = writable<User | null>(null);
		return {
			subscribe
		};
	}

	const { subscribe } = writable<User | null | undefined>(auth?.currentUser ?? undefined, (set) => {
		unsubscribe = onAuthStateChanged(auth, (user) => {
			set(user);
		});

		return () => unsubscribe();
	});

	return {
		subscribe
	};
}

export const user = userStore();

/**
 * @param  {string} path document path or reference
 * @param  {any} startWith optional default data
 * @returns a store with realtime updates on document data
 */
export function docStore<T>(path: string) {
	let unsubscribe: () => void;

	const docRef = doc(db, path);

	const { subscribe } = writable<T | null>(null, (set) => {
		unsubscribe = onSnapshot(docRef, (snapshot) => {
			set((snapshot.data() as T) ?? null);
		});

		return () => unsubscribe();
	});

	return {
		subscribe,
		ref: docRef,
		id: docRef.id
	};
}

export interface UserData {
	username: string;
	photoURL: string;
	workouts: Workout[];
	routines?: Routine[];
	programs?: Program[];
	activeProgramId?: string;
	preferences?: {
		timer: { minutes: number; seconds: number };
		theme?: 'light' | 'dark' | 'system';
		weightUnit?: 'lbs' | 'kg';
		weekStart?: 0 | 1;
		weeklyGoal?: number;
		streaksEnabled?: boolean;
	};
}

export const userData: Readable<UserData | null> = derived(user, ($user, set) => {
	if ($user) {
		return docStore<UserData>(`users/${$user.uid}`).subscribe(set);
	} else {
		set(null);
		return () => {};
	}
});
