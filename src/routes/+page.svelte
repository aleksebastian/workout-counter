<script lang="ts">
	import { user, userData } from '$lib/firebase';
	import { onMount } from 'svelte';

	let showSpinner = false;
	onMount(() => {
		setTimeout(() => {
			showSpinner = true;
		}, 500);
	});
</script>

<div class="flex flex-col items-center gap-6">
	{#if $user === undefined}
		{#if showSpinner}
			<span class="loading loading-spinner loading-md"></span>
		{/if}
	{:else if $user && $userData}
		<p>Welcome {$user.displayName?.split(' ')[0]}!</p>
		{#if $userData.workouts.length}
			<p>Select a workout to begin</p>
			<ul class="menu flex w-56 flex-col gap-4 rounded-box">
				{#each $userData.workouts as workout}
					<li>
						<a class="btn" href={'/workout/' + workout.id}>{workout.name}</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p>Add a workout to begin</p>
		{/if}
	{:else}
		<h2>Log in to get started</h2>
	{/if}
</div>
