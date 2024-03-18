<script lang="ts">
	import { workouts$ } from '$lib/store';
</script>

<div class="flex flex-col items-center gap-6">
	{#if $workouts$.length}
		<p>Select a workout to begin</p>
		<ul class="menu flex w-56 flex-col gap-4 rounded-box">
			{#each $workouts$ as workout}
				<li>
					<a class="btn" href={'/workout/' + workout.id}>{workout.name}</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p>Add a workout to begin</p>
	{/if}
</div>
