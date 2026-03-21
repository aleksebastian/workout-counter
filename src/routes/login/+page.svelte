<script lang="ts">
	import { handleSignIn } from '$lib/logic/auth';

	let error = $state('');

	async function signIn() {
		try {
			await handleSignIn();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			if (msg.includes('missing initial state') || msg.includes('sessionStorage')) {
				error =
					'Sign-in is not supported in this browser context (e.g. private browsing or some in-app browsers). Try opening in Safari or Chrome directly.';
			} else {
				error = msg;
			}
		}
	}
</script>

<div class="prose mx-auto flex flex-col">
	<h2 class="self-center">Keep track of your workout sets</h2>
	<h3 class="self-center">Get results</h3>
	<button class="btn mt-4 w-64 self-center" onclick={signIn}>Sign in with Google</button>
	{#if error}
		<p class="text-error mt-4 text-center text-sm">{error}</p>
	{/if}
</div>
