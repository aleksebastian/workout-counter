import { goto } from '$app/navigation';
import { auth } from '$lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

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

export async function handleSignIn() {
	const provider = new GoogleAuthProvider();

	// Add 15-second timeout to prevent hanging on closed/abandoned popups
	const credential = await withTimeout(
		signInWithPopup(auth, provider),
		15000,
		'Sign-in timed out. Please try again.'
	);

	const idToken = await credential.user.getIdToken();

	await fetch('/api/signin', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ idToken })
	});
	goto('/');
}

export async function handleSignOut() {
	await fetch('/api/signin', { method: 'DELETE' });
	await signOut(auth);
	goto('/login');
}
