<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { v4 as uuidv4 } from 'uuid';
	import { type Workout } from '$lib/state.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import AddIcon from '$lib/icons/add.svg?raw';
	import EditWorkoutSheet from '$lib/components/EditWorkoutSheet.svelte';
	import NewWorkoutSheet from '$lib/components/NewWorkoutSheet.svelte';
	import FAB from '$lib/components/Buttons/FAB.svelte';
	import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
	import { db, user, userData } from '$lib/firebase';
	import { formatDistanceToNow } from 'date-fns';

	type SortKey = 'last-done' | 'a-z' | 'most-sets';

	let isEditingWorkouts = $state(false);
	let showEditWorkoutSheet = $state(false);
	let showNewWorkoutSheet = $state(false);
	let editingWorkout: Workout | undefined = $state(undefined);

	let newWorkoutName = $state('');
	let editedWorkoutName = $state('');
	let search = $state('');
	let sortKey = $state<SortKey>('last-done');

	function lastSetDate(workout: Workout): Date | null {
		if (!workout.sets.length) return null;
		return new Date(Math.max(...workout.sets.map((s) => new Date(s.date).getTime())));
	}

	function lastDoneLabel(workout: Workout): string {
		const d = lastSetDate(workout);
		if (!d) return 'Never done';
		return formatDistanceToNow(d, { addSuffix: true });
	}

	function sortWorkouts(list: Workout[]): Workout[] {
		const copy = [...list];
		if (sortKey === 'a-z') {
			return copy.sort((a, b) => a.name.localeCompare(b.name));
		}
		if (sortKey === 'most-sets') {
			return copy.sort((a, b) => b.sets.length - a.sets.length);
		}
		// last-done: most recent first, never-done at the bottom
		return copy.sort((a, b) => {
			const da = lastSetDate(a);
			const db_ = lastSetDate(b);
			if (!da && !db_) return 0;
			if (!da) return 1;
			if (!db_) return -1;
			return db_.getTime() - da.getTime();
		});
	}

	let filteredWorkouts = $derived(
		sortWorkouts(
			search.trim()
				? ($userData?.workouts ?? []).filter((w) =>
						w.name.toLowerCase().includes(search.toLowerCase())
					)
				: ($userData?.workouts ?? [])
		)
	);

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
			await updateDoc(userRef, { workouts });
		} catch (error) {
			workouts[workoutIndex].name = originalName;
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
			await updateDoc(userRef, { workouts: $userData.workouts });

			if (page.params.workoutId === editingWorkout?.id) {
				goto('/');
			}
		} catch (error) {
			$userData.workouts.splice(workoutIndex, 0, deletedWorkout);
		}
	}

	async function handleAddWorkoutClick() {
		showNewWorkoutSheet = true;
	}

	async function handleNewWorkoutSave(name: string) {
		if (!$userData) return;

		const userRef = doc(db, 'users', $user!.uid);
		const newWorkout = { id: uuidv4(), name: name, sets: [] };

		try {
			await updateDoc(userRef, { workouts: arrayUnion(newWorkout) });
			goto(`/workout/${newWorkout.id}`);
			newWorkoutName = '';
		} catch (error) {}
	}
</script>

<div class="mx-auto flex max-w-lg flex-col gap-4">
	<!-- Header + Sort -->
	{#if $userData?.workouts?.length}
		<div class="flex items-center justify-between">
			<div class="flex gap-1.5" role="group" aria-label="Sort by">
				{#each [['last-done', 'Last done'], ['a-z', 'A–Z'], ['most-sets', 'Most sets']] as const as [key, label]}
					<button
						class="btn btn-xs rounded-full transition-all"
						class:btn-primary={sortKey === key}
						class:btn-ghost={sortKey !== key}
						class:opacity-50={sortKey !== key}
						onclick={() => (sortKey = key)}
					>
						{label}
					</button>
				{/each}
			</div>
			<button
				class="btn btn-ghost btn-sm w-14 font-semibold"
				class:text-primary={isEditingWorkouts}
				onclick={() => (isEditingWorkouts = !isEditingWorkouts)}
			>
				{isEditingWorkouts ? 'Done' : 'Edit'}
			</button>
		</div>
		<div class="relative">
			<input
				type="search"
				placeholder="Search exercises…"
				class="input input-bordered w-full pr-9"
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
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
						><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg
					>
				</button>
			{/if}
		</div>
	{/if}

	<!-- Exercise list -->
	{#if $userData === undefined}
		<div class="flex flex-col gap-3">
			{#each { length: 5 } as _}
				<div class="skeleton h-14 w-full rounded-xl"></div>
			{/each}
		</div>
	{:else if filteredWorkouts.length}
		<ul class="flex flex-col gap-2 pb-16">
			{#each filteredWorkouts as workout}
				<li>
					<a
						href={'/workout/' + workout.id}
						onclick={isEditingWorkouts
							? (e) => {
									e.preventDefault();
									handleWorkoutEditClick(workout);
								}
							: undefined}
						class="bg-base-200 hover:bg-base-300 rounded-box relative flex w-full items-center gap-3 overflow-hidden px-4 py-3 transition-colors active:scale-[0.98]"
					>
						<div class="flex flex-1 flex-col overflow-hidden">
							<span class="truncate text-sm font-semibold">{workout.name}</span>
							<div
								class="grid transition-all duration-200 ease-out"
								style:grid-template-rows={isEditingWorkouts ? '0fr' : '1fr'}
								style:opacity={isEditingWorkouts ? '0' : '1'}
							>
								<div class="overflow-hidden">
									<span
										class={[
											'text-xs',
											lastSetDate(workout) ? 'text-base-content/40' : 'text-base-content/25'
										].join(' ')}>{lastDoneLabel(workout)}</span
									>
								</div>
							</div>
						</div>
						<span class="text-base-content/40 shrink-0 text-xs">{workout.sets.length} sets</span>
						<div class="relative h-4 w-4 shrink-0">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-base-content/30 absolute inset-0 h-4 w-4 transition-opacity duration-200"
								style:opacity={isEditingWorkouts ? '0' : '1'}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
							</svg>
							<span
								class="text-primary absolute inset-0 flex items-center justify-center transition-opacity duration-200 [&>svg]:h-4 [&>svg]:w-4"
								style:opacity={isEditingWorkouts ? '1' : '0'}
							>
								{@html EditIcon}
							</span>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{:else if search.trim()}
		<div class="flex flex-col items-center gap-4 pt-4">
			<p class="text-base-content/50 text-sm">No exercises match "{search}"</p>
			<button
				class="btn btn-primary btn-sm gap-1.5"
				onclick={() => {
					newWorkoutName = search.trim();
					handleNewWorkoutSave(newWorkoutName);
				}}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
					><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg
				>
				Create "{search.trim()}"
			</button>
		</div>
	{:else if $user}
		<div class="flex flex-col items-center gap-3 pt-8">
			<p class="text-base-content/50 text-center text-sm">No exercises yet.</p>
			<button class="btn btn-primary btn-sm" onclick={handleAddWorkoutClick}>
				{@html AddIcon} Add your first exercise
			</button>
		</div>
	{/if}
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

<FAB onclick={handleAddWorkoutClick} hidden={isEditingWorkouts} />
