<script lang="ts">
	import { auth } from '$lib/firebase';
	import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

	async function signInWithGoogle() {
		const provider = new GoogleAuthProvider();
		try {
			const user = await signInWithPopup(auth, provider);

			// await signInWithRedirect(auth, provider);
			// const user = await getRedirectResult(auth);
			console.log(user);
		} catch (error) {
			console.error(error);
		}
	}
</script>

<h2>Login</h2>
<button class="btn" on:click={signInWithGoogle}>Sign in with Google</button>
