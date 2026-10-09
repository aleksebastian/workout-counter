import { goto } from '$app/navigation';
import { auth, db } from '$lib/firebase';
import { clearIndexedDbPersistence, doc, getDoc, terminate } from 'firebase/firestore';
import {
	GoogleAuthProvider,
	getRedirectResult,
	reauthenticateWithPopup,
	signInWithPopup,
	signInWithRedirect,
	signOut,
	type User
} from 'firebase/auth';
import { getPostLoginDestination } from '$lib/logic/onboarding';

/**
 * Creates a promise that rejects after a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => {
			setTimeout(() => reject(new Error(message)), timeoutMs);
		})
	]);
}

/**
 * True while a deliberate sign-out is in flight.
 *
 * `signOut(auth)` makes the client user store emit null well before the
 * navigation to /login commits, which otherwise looks identical to a revoked
 * credential. The layout guard checks this so it doesn't treat the user's own
 * sign-out as a session expiry and tear it down a second time.
 */
let signingOut = false;
export function isSigningOut() {
	return signingOut;
}

/** Set while a redirect sign-in is out at Google, so the return can be picked up. */
const REDIRECT_PENDING_KEY = 'sc-redirect-signin';

/**
 * The installed iOS app can't use the popup: Firebase opens it by simulating a
 * tap on a link, which iOS only honours inside the real tap — and Firebase
 * first waits on network setup, so the sheet often never opened and the
 * button spun forever. A redirect needs no tap. It also needs first-party
 * sign-in helpers to read its result back (see $lib/authDomain), so it's only
 * used where the auth domain is this site.
 */
function useRedirect(): boolean {
	const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
	return standalone && auth.config.authDomain === location.host;
}

/** True when this page load is the return from a redirect sign-in. */
export function returningFromRedirect(): boolean {
	return sessionStorage.getItem(REDIRECT_PENDING_KEY) !== null;
}

/**
 * Picks up a redirect sign-in on its return: the signed-in user, or null if
 * there was none. Rejects with Google's or Firebase's error if it failed.
 */
export async function takeRedirectResult(): Promise<User | null> {
	sessionStorage.removeItem(REDIRECT_PENDING_KEY);
	const result = await getRedirectResult(auth);
	return result?.user ?? auth.currentUser;
}

/**
 * Opens Google's sign-in and resolves with the signed-in user. The caller
 * finishes the session with finishSignIn — the login page checks for a newer
 * build in between. In the installed iOS app this navigates away to Google
 * instead and never resolves; takeRedirectResult picks it up on the way back.
 */
export async function signInWithGoogle(): Promise<User> {
	const provider = new GoogleAuthProvider();
	// Without this, Google silently reuses the only account signed in on the
	// device (common on iOS), so after signing out there's no way to pick a
	// different account.
	provider.setCustomParameters({ prompt: 'select_account' });

	// No timeout here: this resolves only once the person is done on Google's
	// screen, and typing an email, password and 2FA code easily takes longer
	// than any fixed limit. Timing it out left them signed in on the client but
	// stranded on /login without a server session. Closing the popup rejects on
	// its own; the login page offers Cancel for a popup that never reports back.
	if (useRedirect()) {
		sessionStorage.setItem(REDIRECT_PENDING_KEY, '1');
		await signInWithRedirect(auth, provider);
		return new Promise<User>(() => {}); // the page is leaving for Google
	}
	const credential = await signInWithPopup(auth, provider);
	return credential.user;
}

let finishing: Promise<void> | null = null;

/**
 * Turns a Firebase sign-in into an app session: mints the server session
 * cookie, then navigates to wherever this user should land.
 *
 * Separate from signInWithGoogle because on iOS the popup call can reject (Firebase
 * loses track of Google's sheet and reports it closed) while the sign-in still
 * completes behind it. The login page then sees a signed-in user that nothing
 * is finishing, and calls this itself. Concurrent calls share one run.
 */
export function finishSignIn(user: User): Promise<void> {
	finishing ??= completeSession(user).finally(() => (finishing = null));
	return finishing;
}

async function completeSession(user: User) {
	const idToken = await withTimeout(
		user.getIdToken(),
		15000,
		'Sign-in timed out. Please try again.'
	);

	// The server session cookie must exist before we navigate: every route but
	// /login is gated on it server-side, so navigating early lands on a 302
	// straight back here. Surfacing the failure lets the login page say so
	// instead of bouncing the user silently.
	const response = await withTimeout(
		fetch('/api/signin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idToken })
		}),
		15000,
		'Sign-in timed out. Please try again.'
	);
	if (!response.ok) {
		throw new Error("Couldn't start your session. Please try again.");
	}

	const userDoc = await withTimeout(
		getDoc(doc(db, 'users', user.uid)),
		15000,
		'Sign-in timed out. Please try again.'
	);
	const destination = getPostLoginDestination(userDoc.exists() ? userDoc.data() : null);

	// Awaited so the caller's spinner stays up until the page actually commits.
	await goto(destination);
}

export async function handleSignOut() {
	if (signingOut) return;
	signingOut = true;
	try {
		// Clear the server session first, but never let a failed request strand
		// the user signed-in on the client.
		await fetch('/api/signin', { method: 'DELETE' }).catch(() => {});
		await signOut(auth);
		await goto('/login', { replaceState: true });
	} finally {
		signingOut = false;
	}
}

/**
 * Permanently deletes the account. Google sign-in is asked for again first:
 * the server only deletes on a token from the last few minutes, so a session
 * left open on someone's device can't be used to wipe the account.
 *
 * Afterwards the local Firestore cache is cleared too — it holds a full copy
 * of the deleted history — which leaves the SDK unusable, so this ends in a
 * full page load rather than a client-side navigation.
 */
export async function deleteAccount() {
	const current = auth.currentUser;
	if (!current) throw new Error('Sign in again to delete your account.');
	const provider = new GoogleAuthProvider();
	provider.setCustomParameters({ prompt: 'select_account' });
	const fresh = await reauthenticateWithPopup(current, provider).catch((e: { code?: string }) => {
		if (e.code === 'auth/user-mismatch') {
			throw new Error(`Choose ${current.email ?? 'the account you signed in with'} to confirm.`);
		}
		throw e;
	});
	const idToken = await fresh.user.getIdToken(true);

	// Set before the delete: the profile document vanishing would otherwise
	// read as a new account and send the layout to username setup.
	signingOut = true;
	try {
		const response = await fetch('/api/account', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idToken })
		});
		if (!response.ok) throw new Error("Couldn't delete your account. Please try again.");
		await signOut(auth).catch(() => {});
		await terminate(db).catch(() => {});
		await clearIndexedDbPersistence(db).catch(() => {});
		window.location.replace('/login');
	} catch (e) {
		signingOut = false;
		throw e;
	}
}
