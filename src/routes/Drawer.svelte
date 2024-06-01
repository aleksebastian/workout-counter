<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { v4 as uuidv4 } from 'uuid';
	import { isMobileDevice$, workouts$, type Workout } from '$lib/store';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import AddIcon from '$lib/icons/add.svg?raw';
	import EditWorkoutsDialog from './EditWorkoutsDialog.svelte';
	import NewWorkoutDialog from './NewWorkoutDialog.svelte';
	import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
	import { db, user } from '$lib/firebase';
	import { userData } from '$lib/firebase';

	export let open = false;

	let isEditingWorkouts = false;
	let editWorkoutsDialog: HTMLDialogElement;
	let editWorkoutsInputEle: HTMLInputElement;
	let newWorkoutDialog: HTMLDialogElement;
	let newWorkoutNameInputEle: HTMLInputElement;
	let editingWorkout: Workout | undefined = undefined;

	let newWorkoutName = '';
	let newWorkoutError: string | undefined = undefined;
	let editWorkoutError: string | undefined = undefined;

	$: !open && (isEditingWorkouts = false);

	async function handleWorkoutEditClick(workout: Workout) {
		editingWorkout = workout;
		editWorkoutsDialog.showModal();

		if ($isMobileDevice$) {
			return;
		}

		await tick();

		editWorkoutsInputEle.focus();
		editWorkoutsInputEle.select();
	}

	async function handleEditWorkoutResult() {
		if (!$userData) return;

		const userRef = doc(db, 'users', $user!.uid);
		const workoutIndex = $userData.workouts.findIndex(
			(currWorkout) => currWorkout.id === editingWorkout?.id
		);
		const workouts = $userData.workouts;

		if (editWorkoutsDialog.returnValue === 'edit') {
			if ($userData.workouts.some((workout) => workout.name === newWorkoutName)) {
				editWorkoutError = 'Workout already exists';
				return;
			} else if (!newWorkoutName.length) {
				editWorkoutError = 'Workout name missing';
				return;
			}

			workouts[workoutIndex].name = newWorkoutName;

			await updateDoc(userRef, {
				workouts
			});
		} else if (editWorkoutsDialog.returnValue === 'delete') {
			$userData.workouts.splice(workoutIndex, 1);
			await updateDoc(userRef, {
				workouts
			});

			if ($page.params.workoutId === editingWorkout?.id) {
				goto('/');
			}
		}
	}

	async function handleNewWorkoutDialogOpen() {
		newWorkoutDialog.showModal();

		if ($isMobileDevice$) return;

		await tick();

		editWorkoutsInputEle.focus();
		editWorkoutsInputEle.select();
	}

	async function handleNewWorkoutDialogResult() {
		if (!$userData) return;

		if (newWorkoutDialog.returnValue === 'add') {
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
		<slot />
	</div>
	<div class="drawer-side mt-20">
		<label for="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
		<div class="menu min-h-full w-80 bg-base-200 p-4 text-base-content">
			<div class="mb-4 flex items-center justify-between">
				<p class="text-lg font-semibold">Workouts</p>
				<div>
					<button class="btn btn-ghost" on:click={handleNewWorkoutDialogOpen}
						>{@html AddIcon} Add</button
					>
				</div>
				{#if $workouts$.length}
					<button
						class="btn btn-ghost"
						class:btn-active={isEditingWorkouts}
						on:click={() => (isEditingWorkouts = !isEditingWorkouts)}>{@html EditIcon} Edit</button
					>
				{/if}
			</div>
			<ul>
				{#each $workouts$ as workout}
					<li class="mb-1 mt-1">
						{#if isEditingWorkouts}
							<button
								class:btn-active={$page.params.workoutId === workout.id}
								on:click={() => handleWorkoutEditClick(workout)}
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
	bind:inputEle={editWorkoutsInputEle}
	bind:editWorkoutError
	on:close={handleEditWorkoutResult}
	{editingWorkout}
/>

<NewWorkoutDialog
	bind:dialog={newWorkoutDialog}
	bind:inputEle={newWorkoutNameInputEle}
	bind:newWorkoutName
	bind:newWorkoutError
	on:close={handleNewWorkoutDialogResult}
/>
