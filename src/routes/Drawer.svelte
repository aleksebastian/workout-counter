<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { v4 as uuidv4 } from 'uuid';
	import { type Workout } from '$lib/state.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import AddIcon from '$lib/icons/add.svg?raw';
	import EditWorkoutsDialog from './EditWorkoutsDialog.svelte';
	import NewWorkoutDialog from './NewWorkoutDialog.svelte';
	import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
	import { db, user } from '$lib/firebase';
	import { userData } from '$lib/firebase';

	interface Props {
		open?: boolean;
		children?: import('svelte').Snippet;
	}

	let { open = $bindable(false), children }: Props = $props();

	let isEditingWorkouts = $state(false);
	let editWorkoutsDialog: HTMLDialogElement = $state()!;
	let editWorkoutsInputEle: HTMLInputElement = $state()!;
	let newWorkoutDialog: HTMLDialogElement = $state()!;
	let newWorkoutNameInputEle: HTMLInputElement = $state()!;
	let editingWorkout: Workout | undefined = $state(undefined);

	let newWorkoutName = $state('');
	let editedWorkoutName = $state('');

	$effect(() => {
		!open && (isEditingWorkouts = false);
	});

	async function handleWorkoutEditClick(workout: Workout) {
		editingWorkout = workout;
		editWorkoutsDialog?.showModal();
	}

	async function handleEditWorkoutResult() {
		if (!$userData) return;

		const userRef = doc(db, 'users', $user!.uid);
		const workoutIndex = $userData.workouts.findIndex(
			(currWorkout) => currWorkout.id === editingWorkout?.id
		);
		const workouts = $userData.workouts;

		if (editWorkoutsDialog?.returnValue === 'edit') {
			// Save original state for rollback
			const originalName = workouts[workoutIndex].name;
			workouts[workoutIndex].name = editedWorkoutName;

			try {
				await updateDoc(userRef, {
					workouts
				});
			} catch (error) {
				// Rollback on error
				workouts[workoutIndex].name = originalName;
				console.error('Failed to update workout:', error);
			}
		} else if (editWorkoutsDialog?.returnValue === 'delete') {
			// Save original state for rollback
			const deletedWorkout = $userData.workouts[workoutIndex];
			$userData.workouts.splice(workoutIndex, 1);

			try {
				await updateDoc(userRef, {
					workouts
				});

				if (page.params.workoutId === editingWorkout?.id) {
					goto('/');
				}
			} catch (error) {
				// Rollback on error
				$userData.workouts.splice(workoutIndex, 0, deletedWorkout);
				console.error('Failed to delete workout:', error);
			}
		}
	}

	async function handleAddWorkoutClick() {
		newWorkoutDialog?.showModal();
	}

	async function handleNewWorkoutDialogResult() {
		if (!$userData) return;

		if (newWorkoutDialog?.returnValue === 'add') {
			const userRef = doc(db, 'users', $user!.uid);
			const newWorkout = { id: uuidv4(), name: newWorkoutName, sets: [] };

			try {
				await updateDoc(userRef, {
					workouts: arrayUnion(newWorkout)
				});

				goto(`/workout/${newWorkout.id}`);
				newWorkoutName = '';
			} catch (error) {
				console.error('Failed to create workout:', error);
				// Could show a toast notification here
			}
		}
	}
</script>

<div class="drawer static">
	<input
		aria-label="Toggle Drawer"
		id="my-drawer"
		type="checkbox"
		class="drawer-toggle"
		bind:checked={open}
	/>
	<div class="drawer-content">
		{@render children?.()}
	</div>
	<div class="drawer-side mt-20">
		<label for="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
		<div class="menu bg-base-200 text-base-content min-h-full w-80 p-4">
			<div class="mb-4 flex items-center justify-between">
				<p class="text-lg font-semibold">Workouts</p>
				{#if $user}
					<div>
						<button class="btn btn-ghost" onclick={handleAddWorkoutClick}
							>{@html AddIcon} Add</button
						>
					</div>
				{/if}
				{#if $userData?.workouts?.length}
					<button
						class="btn btn-ghost"
						class:btn-active={isEditingWorkouts}
						onclick={() => (isEditingWorkouts = !isEditingWorkouts)}>{@html EditIcon} Edit</button
					>
				{/if}
			</div>
			<ul>
				{#if $userData}
					{#each $userData.workouts as workout}
						<li class="mt-1 mb-1">
							{#if isEditingWorkouts}
								<button
									class:btn-active={page.params.workoutId === workout.id}
									onclick={() => handleWorkoutEditClick(workout)}
								>
									{workout.name}
								</button>
							{:else}
								<a
									class:btn-active={page.params.workoutId === workout.id}
									href={'/workout/' + workout.id}
									onclick={() => (open = false)}
								>
									{workout.name}
								</a>
							{/if}
						</li>
					{:else}
						<li class="mb-1 mt-1">Add a workout to begin</li>
					{/each}
				{/if}
			</ul>
		</div>
	</div>
</div>

<EditWorkoutsDialog
	bind:dialog={editWorkoutsDialog}
	bind:name={editedWorkoutName}
	bind:inputEle={editWorkoutsInputEle}
	onclose={handleEditWorkoutResult}
	{editingWorkout}
/>

<NewWorkoutDialog
	bind:dialog={newWorkoutDialog}
	bind:inputEle={newWorkoutNameInputEle}
	bind:newWorkoutName
	onclose={handleNewWorkoutDialogResult}
/>
