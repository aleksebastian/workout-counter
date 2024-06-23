<script lang="ts">
	import { handleSignIn } from '$lib/logic/auth';
</script>

<div class="flex flex-col justify-center gap-4">
	<button class="btn w-64 self-center" on:click={handleSignIn}>Sign in with Google</button>
</div>
