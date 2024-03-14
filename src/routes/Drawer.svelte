<script lang="ts">
	export let isDrawerOpen = false;
	import { selectedWorkout$, workouts$, type Workout } from '$lib/store';
	import EditWorkoutsModal from './EditWorkoutsModal.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';

	let isEditingWorkouts = false;
	let editingWorkout: Workout | undefined = undefined;

	function handleWorkoutClick(workout: Workout) {
		if (isEditingWorkouts) {
			console.log('hi');
			editingWorkout = workout;
			isEditWorkoutsModalOpen = true;
		} else {
			$selectedWorkout$ = workout;
			isDrawerOpen = false;
		}
	}

	let isEditWorkoutsModalOpen = false;
</script>

<div class="drawer">
	<input id="my-drawer" type="checkbox" class="drawer-toggle" bind:checked={isDrawerOpen} />
	<div class="drawer-content">
		<slot />
	</div>
	<div class="drawer-side">
		<label for="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
		<ul class="menu min-h-full w-80 bg-base-200 p-4 text-base-content">
			<div class="mb-4 flex items-center justify-between">
				<p class="text-lg font-semibold">Workouts</p>
				<button
					class="rounded-md p-2"
					class:btn-active={isEditingWorkouts}
					on:click={() => (isEditingWorkouts = !isEditingWorkouts)}>{@html EditIcon}</button
				>
			</div>
			{#each $workouts$ as workout}
				<li class="mb-1 mt-1">
					<button
						class:btn-active={workout.id === $selectedWorkout$?.id}
						on:click={() => handleWorkoutClick(workout)}>{workout.name}</button
					>
				</li>
			{/each}
		</ul>
	</div>
</div>

<EditWorkoutsModal bind:open={isEditWorkoutsModalOpen} {editingWorkout} />
