<script lang="ts">
	import { auth } from '$lib/firebase';
	import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

	async function signInWithGoogle() {
		const provider = new GoogleAuthProvider();
		try {
			const user = await signInWithPopup(auth, provider);

			// await signInWithRedirect(auth, provider);
			// const user = await getRedirectResult(auth);
		} catch (error) {
			console.error(error);
		}
	}
</script>

<div class="flex flex-col justify-center gap-4">
	<h2 class="text-center">Login</h2>
	<button class="btn w-64 self-center" on:click={signInWithGoogle}>Sign in with Google</button>
</div>
