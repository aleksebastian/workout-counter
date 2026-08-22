import { goto } from '$app/navigation';
import { auth, db } from '$lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
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

export async function handleSignIn() {
	const provider = new GoogleAuthProvider();

	const credential = await withTimeout(
		signInWithPopup(auth, provider),
		15000,
		'Sign-in timed out. Please try again.'
	);

	const idToken = await credential.user.getIdToken();

	// The server session cookie must exist before we navigate: every route but
	// /login is gated on it server-side, so navigating early lands on a 302
	// straight back here. Surfacing the failure lets the login page say so
	// instead of bouncing the user silently.
	const response = await fetch('/api/signin', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ idToken })
	});
	if (!response.ok) {
		throw new Error("Couldn't start your session. Please try again.");
	}

	const userDoc = await getDoc(doc(db, 'users', credential.user.uid));
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
