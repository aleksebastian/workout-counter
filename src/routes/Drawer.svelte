<script lang="ts">
	import { isMobileDevice$, workouts$, type Workout } from '$lib/store';
	import EditWorkoutsDialog from './EditWorkoutsDialog.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import { tick } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	export let open = false;
	let editWorkoutsDialog: HTMLDialogElement;
	let inputEle: HTMLInputElement;
	let isEditingWorkouts = false;
	let editingWorkout: Workout | undefined = undefined;
	let newWorkoutName = '';

	$: !open && (isEditingWorkouts = false);

	async function handleWorkoutClick(workout: Workout) {
		editingWorkout = workout;
		editWorkoutsDialog.showModal();

		if ($isMobileDevice$) {
			return;
		}

		await tick();

		inputEle.focus();
		inputEle.select();
	}

	function handleWorkoutEditClick() {
		const index = $workouts$.findIndex((currWorkout) => currWorkout.id === editingWorkout?.id);
		$workouts$[index].name = newWorkoutName;
		$workouts$ = $workouts$;

		localStorage.setItem('workouts', JSON.stringify($workouts$));
	}

	function handleWorkoutDeleteClick() {
		const index = $workouts$.findIndex((currWorkout) => currWorkout.id === editingWorkout?.id);
		$workouts$.splice(index, 1);
		$workouts$ = $workouts$;

		if ($page.params.workoutId === editingWorkout?.id) {
			goto('/');
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
	<input
		aria-label="Toggle Drawer"
		id="my-drawer"
		type="checkbox"
		class="drawer-toggle"
		bind:checked={open}
	/>
	<div class="drawer-content">
		<slot />
	</div>
	<div class="drawer-side mt-20">
		<label for="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
		<div class="menu min-h-full w-80 bg-base-200 p-4 text-base-content">
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
			<ul>
				{#each $workouts$ as workout}
					<li class="mb-1 mt-1">
						{#if isEditingWorkouts}
							<button
								class:btn-active={$page.params.workoutId === workout.id}
								on:click={() => handleWorkoutClick(workout)}
							>
								{workout.name}
							</button>
						{:else}
							<a
								class:btn-active={$page.params.workoutId === workout.id}
								href={'/workout/' + workout.id}
								on:click={() => (open = false)}
							>
								{workout.name}
							</a>
						{/if}
					</li>
				{:else}
					<li class="mb-1 mt-1">Add a workout to begin</li>
				{/each}
			</ul>
		</div>
	</div>
</div>

<EditWorkoutsDialog
	bind:dialog={editWorkoutsDialog}
	bind:name={newWorkoutName}
	bind:inputEle
	on:close={handleEditWorkoutResult}
	{editingWorkout}
/>
