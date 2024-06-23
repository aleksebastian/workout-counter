<script lang="ts">
	import { user, userData } from '$lib/firebase';
	import { onMount } from 'svelte';
</script>

{#if $user}
	<div class="flex flex-col items-center gap-6">
		{#if $userData}
			<p>Welcome {$user.displayName?.split(' ')[0]}!</p>
			{#if $userData.workouts.length}
				<p>Time since last set: 1:30</p>
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
		{/if}
	</div>
{/if}
