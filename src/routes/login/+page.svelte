<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/firebase';
	import { handleSignIn } from '$lib/logic/auth';

	import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

	async function signInWithGoogle() {
		const provider = new GoogleAuthProvider();
		const credential = await signInWithPopup(auth, provider);

		const idToken = await credential.user.getIdToken();

		const res = await fetch('/api/signin', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ idToken })
		});

		goto('/');
	}

	async function signOutSSR() {
		const res = await fetch('/api/signin', { method: 'DELETE' });
		await signOut(auth);
	}
</script>

<div class="prose flex flex-col">
	<h2 class="self-center">Keep track of your workout sets</h2>
	<h3 class="self-center">Get results</h3>
	<button class="btn mt-4 w-64 self-center" on:click={handleSignIn}>Sign in with Google</button>
</div>
