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
			workouts[workoutIndex].name = editedWorkoutName;

			await updateDoc(userRef, {
				workouts
			});
		} else if (editWorkoutsDialog?.returnValue === 'delete') {
			$userData.workouts.splice(workoutIndex, 1);
			await updateDoc(userRef, {
				workouts
			});

			if (page.params.workoutId === editingWorkout?.id) {
				goto('/');
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

			await updateDoc(userRef, {
				workouts: arrayUnion({ id: uuidv4(), name: newWorkoutName, sets: [] })
			});

			goto(`/workout/${$userData.workouts[$userData.workouts.length - 1].id}`);
			newWorkoutName = '';
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
		<div class="menu min-h-full w-80 bg-base-200 p-4 text-base-content">
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
						<li class="mb-1 mt-1">
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
