import { goto } from '$app/navigation';
import { auth } from '$lib/firebase';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';

export async function handleSignIn() {
	const provider = new GoogleAuthProvider();
	await signInWithRedirect(auth, provider);
	// Page navigates away; execution does not continue here.
}

export async function handleRedirectResult() {
	const result = await getRedirectResult(auth);
	if (!result) return;

	const idToken = await result.user.getIdToken();
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
