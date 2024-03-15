<script lang="ts">
	import { isMobileDevice$, selectedWorkout$, workouts$, type Workout } from '$lib/store';
	import EditWorkoutsDialog from './EditWorkoutsDialog.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import { tick } from 'svelte';

	export let isDrawerOpen = false;
	let editWorkoutsDialog: HTMLDialogElement;
	let inputEle: HTMLInputElement;
	let isEditingWorkouts = false;
	let editingWorkout: Workout | undefined = undefined;
	let newWorkoutName = '';

	$: !isDrawerOpen && (isEditingWorkouts = false);

	async function handleWorkoutClick(workout: Workout) {
		if (isEditingWorkouts) {
			editingWorkout = workout;
			editWorkoutsDialog.showModal();

			if ($isMobileDevice$) {
				return;
			}

			await tick();

			inputEle.focus();
			inputEle.select();
		} else {
			$selectedWorkout$ = workout;
			isDrawerOpen = false;
		}
	}

	function handleWorkoutEditClick() {
		const index = $workouts$.findIndex((currWorkout) => currWorkout.id === editingWorkout?.id);

		$workouts$[index].name = newWorkoutName;

		$workouts$ = $workouts$;
		$selectedWorkout$ = $workouts$[index];

		localStorage.setItem('workouts', JSON.stringify($workouts$));
	}

	function handleWorkoutDeleteClick() {
		const index = $workouts$.findIndex((currWorkout) => currWorkout.id === editingWorkout?.id);
		$workouts$.splice(index, 1);
		$workouts$ = $workouts$;

		if ($selectedWorkout$?.id === editingWorkout?.id) {
			$selectedWorkout$ = undefined;
		}

		localStorage.setItem('workouts', JSON.stringify($workouts$));
	}

	function handleEditWorkoutResult() {
		if (editWorkoutsDialog.returnValue === 'edit') {
			handleWorkoutEditClick();
		} else if (editWorkoutsDialog.returnValue === 'delete') {
			handleWorkoutDeleteClick();
		}
	}
</script>

<div class="drawer">
	<input id="my-drawer" type="checkbox" class="drawer-toggle" bind:checked={isDrawerOpen} />
	<div class="drawer-content">
		<slot />
	</div>
	<div class="drawer-side mt-[80px]">
		<label for="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
		<ul class="menu min-h-full w-80 bg-base-200 p-4 text-base-content">
			<div class="mb-4 flex items-center justify-between">
				<p class="text-lg font-semibold">Workouts</p>
				{#if $workouts$.length}
					<button
						class="rounded-md p-2"
						class:btn-active={isEditingWorkouts}
						on:click={() => (isEditingWorkouts = !isEditingWorkouts)}>{@html EditIcon}</button
					>
				{/if}
			</div>
			{#each $workouts$ as workout}
				<li class="mb-1 mt-1">
					<button
						class:btn-active={workout.id === $selectedWorkout$?.id}
						on:click={() => handleWorkoutClick(workout)}>{workout.name}</button
					>
				</li>
			{:else}
				<li class="mb-1 mt-1">Add a workout to begin</li>
			{/each}
		</ul>
	</div>
</div>

<EditWorkoutsDialog
	bind:dialog={editWorkoutsDialog}
	bind:name={newWorkoutName}
	bind:inputEle
	on:close={handleEditWorkoutResult}
	{editingWorkout}
/>
