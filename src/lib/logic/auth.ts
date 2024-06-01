import { goto } from '$app/navigation';
import { auth } from '$lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

export async function signInWithGoogle() {
	const provider = new GoogleAuthProvider();
	const credential = await signInWithPopup(auth, provider);

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
