import { initializeApp } from 'firebase/app';
import {
	doc,
	collection,
	query,
	orderBy,
	getFirestore,
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
	onSnapshot
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { writable, type Readable, derived } from 'svelte/store';
import type { Workout, Routine, Program, UserData } from '$lib/types';

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
				}),
				ignoreUndefinedProperties: true
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

/**
 * @param  {string} path collection path
 * @returns a store with realtime updates on collection data, ordered by `createdAt`
 */
export function collectionStore<T>(path: string) {
	let unsubscribe: () => void;

	const ref = query(collection(db, path), orderBy('createdAt'));

	const { subscribe } = writable<T[] | null>(null, (set) => {
		unsubscribe = onSnapshot(ref, (snapshot) => {
			set(snapshot.docs.map((d) => d.data() as T));
		});

		return () => unsubscribe();
	});

	return { subscribe };
}

/** Builds a store over a subcollection of the signed-in user's document. */
function userCollection<T>(name: string): Readable<T[] | null> {
	return derived(user, ($user, set) => {
		if ($user) {
			return collectionStore<T>(`users/${$user.uid}/${name}`).subscribe(set);
		}
		set(null);
		return () => {};
	});
}

/**
 * Exercises, routines and programs each live in their own subcollection under
 * the user document. Keeping them out of the user doc means concurrent writes
 * to different entities can never clobber each other, and recording a set is a
 * single atomic `arrayUnion` on one exercise document.
 */
export const workouts = userCollection<Workout>('workouts');
export const routines = userCollection<Routine>('routines');
export const programs = userCollection<Program>('programs');

export const userData: Readable<UserData | null> = derived(user, ($user, set) => {
	if ($user) {
		return docStore<UserData>(`users/${$user.uid}`).subscribe(set);
	} else {
		set(null);
		return () => {};
	}
});

export type { UserData };
