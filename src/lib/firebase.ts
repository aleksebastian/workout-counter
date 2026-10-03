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
import type { Workout, Routine, Program, UserData, Parse } from '$lib/types';
import { parseWorkout, parseRoutine, parseProgram, parseUserData } from '$lib/types';

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
 * Snapshot listeners that have failed, keyed by path.
 *
 * Firestore *terminates* a listener when it errors and never retries, so a
 * permission or network failure used to leave the store silently pinned at its
 * initial value forever. Recording it here lets the UI say so — and offer a
 * reload, which is the only real recovery — instead of showing a skeleton that
 * never resolves.
 */
export const storeErrors = writable<Record<string, string>>({});

function reportStoreError(path: string, err: unknown) {
	console.error(`[firebase] snapshot failed for ${path}:`, err);
	const message = err instanceof Error ? err.message : String(err);
	storeErrors.update((all) => ({ ...all, [path]: message }));
}

function clearStoreError(path: string) {
	storeErrors.update((all) => {
		if (!(path in all)) return all;
		const { [path]: _removed, ...rest } = all;
		return rest;
	});
}

/**
 * @param path document path
 * @param parse turns the raw document into a trusted domain object
 * @returns a store with realtime updates on document data.
 *   `undefined` means no snapshot has been delivered yet; `null` means the
 *   document is confirmed not to exist. Callers depend on that distinction —
 *   collapsing both to `null` makes "still loading" and "no profile yet"
 *   indistinguishable, which strands new accounts on a permanent skeleton.
 */
export function docStore<T>(path: string, parse: Parse<T>) {
	let unsubscribe: () => void;

	const docRef = doc(db, path);

	const { subscribe } = writable<T | null | undefined>(undefined, (set) => {
		unsubscribe = onSnapshot(
			docRef,
			// Metadata changes are required: when the first emission is a cache
			// miss we skip it (below), and the server's confirmation that the
			// document really is absent arrives as a metadata-only change. Without
			// this the listener would never fire again.
			{ includeMetadataChanges: true },
			(snapshot) => {
				// "Missing, according to the local cache" is not authoritative — it
				// is the offline default for a document we simply haven't fetched.
				// Treating it as confirmed absence would flash `onboarding` and
				// bounce a returning user to username setup.
				if (!snapshot.exists() && snapshot.metadata.fromCache) return;
				clearStoreError(path);
				set(snapshot.exists() ? parse(snapshot.data(), snapshot.id) : null);
			},
			(err) => reportStoreError(path, err)
		);

		return () => unsubscribe();
	});

	return {
		subscribe,
		ref: docRef,
		id: docRef.id
	};
}

/**
 * @param path collection path
 * @param parse turns each raw document into a trusted domain object
 * @returns a store with realtime updates on collection data, ordered by `createdAt`
 */
export function collectionStore<T>(path: string, parse: Parse<T>) {
	let unsubscribe: () => void;

	const ref = query(collection(db, path), orderBy('createdAt'));

	const { subscribe } = writable<T[] | null>(null, (set) => {
		unsubscribe = onSnapshot(
			ref,
			(snapshot) => {
				clearStoreError(path);
				// Passing the document id as a fallback also covers documents whose
				// stored `id` field is missing, which would otherwise break every
				// lookup that matches on it.
				set(snapshot.docs.map((d) => parse(d.data(), d.id)));
			},
			(err) => reportStoreError(path, err)
		);

		return () => unsubscribe();
	});

	return { subscribe };
}

/** Builds a store over a subcollection of the signed-in user's document. */
function userCollection<T>(name: string, parse: Parse<T>): Readable<T[] | null> {
	return derived(user, ($user, set) => {
		if ($user) {
			return collectionStore<T>(`users/${$user.uid}/${name}`, parse).subscribe(set);
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
 *
 * `parse` is required rather than optional so a new collection cannot be added
 * without deciding how its documents are validated.
 */
export const workouts = userCollection<Workout>('workouts', parseWorkout);
export const routines = userCollection<Routine>('routines', parseRoutine);
export const programs = userCollection<Program>('programs', parseProgram);

export const userData: Readable<UserData | null | undefined> = derived(user, ($user, set) => {
	if ($user) {
		return docStore<UserData>(`users/${$user.uid}`, parseUserData).subscribe(set);
	} else {
		set(null);
		return () => {};
	}
});

export type { UserData };
