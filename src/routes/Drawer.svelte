<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { v4 as uuidv4 } from 'uuid';
	import { type Workout } from '$lib/state.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import AddIcon from '$lib/icons/add.svg?raw';
	import EditWorkoutSheet from '$lib/components/EditWorkoutSheet.svelte';
	import NewWorkoutSheet from '$lib/components/NewWorkoutSheet.svelte';
	import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
	import { db, user } from '$lib/firebase';
	import { userData } from '$lib/firebase';

	interface Props {
		open?: boolean;
		children?: import('svelte').Snippet;
	}

	let { open = $bindable(false), children }: Props = $props();

	let isEditingWorkouts = $state(false);
	let showEditWorkoutSheet = $state(false);
	let showNewWorkoutSheet = $state(false);
	let editingWorkout: Workout | undefined = $state(undefined);

	let newWorkoutName = $state('');
	let editedWorkoutName = $state('');
	let search = $state('');

	let filteredWorkouts = $derived(
		search.trim()
			? ($userData?.workouts ?? []).filter((w) =>
					w.name.toLowerCase().includes(search.toLowerCase())
				)
			: ($userData?.workouts ?? [])
	);

	$effect(() => {
		!open && (isEditingWorkouts = false);
	});

	async function handleWorkoutEditClick(workout: Workout) {
		editingWorkout = workout;
		showEditWorkoutSheet = true;
	}

	async function handleEditWorkoutSave(name: string) {
		if (!$userData) return;

		const userRef = doc(db, 'users', $user!.uid);
		const workoutIndex = $userData.workouts.findIndex(
			(currWorkout) => currWorkout.id === editingWorkout?.id
		);
		const workouts = $userData.workouts;

		if (!name.trim()) return;
		const originalName = workouts[workoutIndex].name;
		workouts[workoutIndex].name = name;

		try {
			await updateDoc(userRef, {
				workouts
			});
		} catch (error) {
			workouts[workoutIndex].name = originalName;
			console.error('Failed to update workout:', error);
		}
	}

	async function handleEditWorkoutDelete() {
		if (!$userData) return;

		const userRef = doc(db, 'users', $user!.uid);
		const workoutIndex = $userData.workouts.findIndex(
			(currWorkout) => currWorkout.id === editingWorkout?.id
		);
		const deletedWorkout = $userData.workouts[workoutIndex];
		$userData.workouts.splice(workoutIndex, 1);

		try {
			await updateDoc(userRef, {
				workouts: $userData.workouts
			});

			if (page.params.workoutId === editingWorkout?.id) {
				goto('/');
			}
		} catch (error) {
			$userData.workouts.splice(workoutIndex, 0, deletedWorkout);
			console.error('Failed to delete workout:', error);
		}
	}

	async function handleAddWorkoutClick() {
		showNewWorkoutSheet = true;
	}

	async function handleNewWorkoutSave(name: string) {
		if (!$userData) return;

		const userRef = doc(db, 'users', $user!.uid);
		const newWorkout = { id: uuidv4(), name, sets: [] };

		try {
			await updateDoc(userRef, {
				workouts: arrayUnion(newWorkout)
			});

			goto(`/workout/${newWorkout.id}`);
			newWorkoutName = '';
		} catch (error) {
			console.error('Failed to create workout:', error);
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
			{#if $userData?.workouts?.length}
				<div class="relative mb-3">
					<input
						type="search"
						placeholder="Search workouts…"
						class="input input-bordered input-sm w-full pr-8"
						bind:value={search}
					/>
					{#if search}
						<button
							class="text-base-content/30 hover:text-base-content/60 absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors"
							onclick={() => (search = '')}
							aria-label="Clear search"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3.5 w-3.5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.5"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M6 18L18 6M6 6l12 12"
								/></svg
							>
						</button>
					{/if}
				</div>
			{/if}
			<ul>
				{#if $userData}
					{#each filteredWorkouts as workout}
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
						<li class="mb-1 mt-1">{search.trim() ? 'No results' : 'Add a workout to begin'}</li>
					{/each}
				{/if}
			</ul>
		</div>
	</div>
</div>

<EditWorkoutSheet
	bind:open={showEditWorkoutSheet}
	bind:name={editedWorkoutName}
	{editingWorkout}
	onSave={handleEditWorkoutSave}
	onDelete={handleEditWorkoutDelete}
/>

<NewWorkoutSheet
	bind:open={showNewWorkoutSheet}
	bind:newWorkoutName
	onSave={handleNewWorkoutSave}
/>
