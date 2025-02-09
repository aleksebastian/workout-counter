import { goto } from '$app/navigation';
import { auth } from '$lib/firebase';
import {
	getRedirectResult,
	GoogleAuthProvider,
	signInWithPopup,
	signInWithRedirect,
	signOut,
	type UserCredential
} from 'firebase/auth';

export async function signInWithGoogle() {
	const provider = new GoogleAuthProvider();
	let credential: UserCredential | undefined;
	const isPwa =
		window.matchMedia('(display-mode: fullscreen)').matches ||
		window.matchMedia('(display-mode: standalone)').matches;
	if (isPwa) {
		console.log('signing in with redirect');
		signInWithRedirect(auth, provider);
		const result = await getRedirectResult(auth);
		if (result) {
			credential = result;
		} else {
			throw new Error('No result from redirect');
		}
	} else {
		console.log('signing in with popup');
		credential = await signInWithPopup(auth, provider);
	}

	return await credential.user.getIdToken();
}

export async function handleSignIn() {
	const idToken = await signInWithGoogle();

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
