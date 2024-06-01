<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { user } from '$lib/firebase';
	import { handleSignIn } from '$lib/logic/auth';

	onMount(() => {
		if ($user) {
			goto('/');
		}
	});
</script>

<div class="flex flex-col justify-center gap-4">
	<button class="btn w-64 self-center" on:click={handleSignIn}>Sign in with Google</button>
</div>
