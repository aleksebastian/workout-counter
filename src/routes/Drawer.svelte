<script lang="ts">
	export let isDrawerOpen = false;
	import { selectedWorkout$, workouts$, type Workout } from '$lib/store';

	function handleWorkoutClick(workout: Workout) {
		$selectedWorkout$ = workout;
		isDrawerOpen = false;
	}
</script>

<div class="drawer">
	<input id="my-drawer" type="checkbox" class="drawer-toggle" bind:checked={isDrawerOpen} />
	<div class="drawer-content">
		<slot />
	</div>
	<div class="drawer-side">
		<label for="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
		<ul class="menu min-h-full w-80 bg-base-200 p-4 text-base-content">
			<p class="text-lg font-semibold">Workouts</p>
			{#each $workouts$ as workout}
				<li>
					<button
						class:btn-active={workout.id === $selectedWorkout$?.id}
						on:click={() => handleWorkoutClick(workout)}>{workout.name}</button
					>
				</li>
			{/each}
		</ul>
	</div>
</div>
