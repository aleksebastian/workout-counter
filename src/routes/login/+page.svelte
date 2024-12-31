<script lang="ts">
	import { handleSignIn } from '$lib/logic/auth';
</script>

<div class="prose mx-auto flex flex-col">
	<h2 class="self-center">Keep track of your workout sets</h2>
	<h3 class="self-center">Get results</h3>
	<button class="btn mt-4 w-64 self-center" on:click={handleSignIn}>Sign in with Google</button>
</div>
