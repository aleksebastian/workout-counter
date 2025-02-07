import { initializeApp } from 'firebase/app';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { writable, type Readable, derived } from 'svelte/store';
import type { Workout } from './state.svelte';
import { browser } from '$app/environment';

let authDomain = 'workout-counter-99d56.firebaseapp.com';

const isPwa = browser
	? window.matchMedia('(display-mode: fullscreen)').matches ||
		window.matchMedia('(display-mode: standalone)').matches
	: false;

if (isPwa) {
	const domainParts = window.location.hostname.split('.');
	const domain = domainParts.slice(-2).join('.');
	authDomain = domain;
}

const firebaseConfig = {
	apiKey: 'AIzaSyB2Wxz_yyr7spT7MrwhxpGPK9XXbo8SDmU',
	authDomain,
	projectId: 'workout-counter-99d56',
	storageBucket: 'workout-counter-99d56.appspot.com',
	messagingSenderId: '478354387280',
	appId: '1:478354387280:web:23f072341f031c76ed3c55',
	measurementId: 'G-9KJS0LCCEV'
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore();
export const auth = getAuth();
export const storage = getStorage();

/**
 * @returns a store with the current firebase user
 */
function userStore() {
	let unsubscribe: () => void;

	if (!auth || !globalThis.window) {
		console.warn('Auth is not initialized or not in browser');
		const { subscribe } = writable<User | null>(null);
		return {
			subscribe
		};
	}

	const { subscribe } = writable(auth?.currentUser ?? null, (set) => {
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
	bio: string;
	photoURL: string;
	workouts: Workout[];
	preferences?: { timer: { minutes: number; seconds: number } };
}

export const userData: Readable<UserData | null> = derived(user, ($user, set) => {
	if ($user) {
		return docStore<UserData>(`users/${$user.uid}`).subscribe(set);
	} else {
		set(null);
	}
});
