<script lang="ts">
	import { user, userData, db } from '$lib/firebase';
	import { type Routine, type Workout, getRoutineExercises, toaster } from '$lib/state.svelte';
	import { v4 as uuidv4 } from 'uuid';
	import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
	import { formatDistanceToNow } from 'date-fns';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import AddIcon from '$lib/icons/add.svg?raw';
	import NewRoutineSheet from '$lib/components/NewRoutineSheet.svelte';
	import EditRoutineSheet from '$lib/components/EditRoutineSheet.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import FAB from '$lib/components/Buttons/FAB.svelte';

	let showNewRoutineSheet = $state(false);
	let showEditRoutineSheet = $state(false);
	let newRoutineName = $state('');
	let editedRoutineName = $state('');
	let editingRoutine: Routine | undefined = $state(undefined);
	let isEditingRoutines = $state(false);

	function getRoutineStats(routine: Routine) {
		const workouts = getRoutineExercises(routine)
			.map((ex) => $userData?.workouts.find((w) => w.id === ex.workoutId))
			.filter(Boolean) as Workout[];
		const today = new Date().toDateString();
		const doneToday = workouts.filter((w) =>
			w.sets.some((s) => new Date(s.date).toDateString() === today)
		).length;
		const allTimes = workouts.flatMap((w) => w.sets.map((s) => new Date(s.date).getTime()));
		const lastSession = allTimes.length ? new Date(Math.max(...allTimes)) : null;
		return { doneToday, lastSession };
	}

	async function handleAddRoutineClick() {
		showNewRoutineSheet = true;
	}

	async function handleNewRoutineSave(name: string) {
		if (!$userData) return;
		const userRef = doc(db, 'users', $user!.uid);
		const newRoutine: Routine = { id: uuidv4(), name, exercises: [] };
		try {
			await updateDoc(userRef, { routines: arrayUnion(newRoutine) });
			newRoutineName = '';
		} catch (error) {
			toaster.addToast({
				type: 'error',
				message: "Couldn't create routine — try again",
				dismissible: true
			});
		}
	}

	async function handleRoutineEditClick(routine: Routine) {
		editingRoutine = routine;
		showEditRoutineSheet = true;
	}

	async function handleEditRoutineSave(
		name: string,
		timer?: { minutes: number; seconds: number },
		notes?: string
	) {
		if (!$userData) return;
		const routines = $userData.routines ?? [];
		const routineIndex = routines.findIndex((r) => r.id === editingRoutine?.id);
		const userRef = doc(db, 'users', $user!.uid);
		const original = { ...routines[routineIndex] };
		routines[routineIndex] = {
			...routines[routineIndex],
			name,
			...(timer ? { timer } : { timer: undefined }),
			...(notes ? { notes } : { notes: undefined })
		};
		try {
			await updateDoc(userRef, { routines });
		} catch (error) {
			routines[routineIndex] = original;
			toaster.addToast({
				type: 'error',
				message: "Couldn't save routine — try again",
				dismissible: true
			});
		}
	}

	async function handleEditRoutineDelete() {
		if (!$userData) return;
		const routines = $userData.routines ?? [];
		const routineIndex = routines.findIndex((r) => r.id === editingRoutine?.id);
		const userRef = doc(db, 'users', $user!.uid);
		const deleted = routines.splice(routineIndex, 1)[0];
		try {
			await updateDoc(userRef, { routines });
		} catch (error) {
			routines.splice(routineIndex, 0, deleted);
			toaster.addToast({
				type: 'error',
				message: "Couldn't delete routine — try again",
				dismissible: true
			});
		}
	}

	async function handleRefresh() {
		await new Promise((r) => setTimeout(r, 600));
	}
</script>

<PullToRefresh onRefresh={handleRefresh}>
	{#if $userData === undefined}
		<!-- Skeleton -->
		<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
			<div class="flex items-center justify-between">
				<div class="skeleton h-7 w-28 rounded-lg"></div>
				<div class="skeleton h-9 w-14 rounded-xl"></div>
			</div>
			{#each { length: 3 } as _}
				<div class="skeleton h-20 w-full rounded-2xl"></div>
			{/each}
		</div>
	{:else}
		<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
			<!-- Header -->
			<div class="flex justify-end">
				{#if $userData?.routines?.length}
					<button
						class="btn btn-ghost btn-sm w-14 font-semibold"
						class:text-primary={isEditingRoutines}
						onclick={() => (isEditingRoutines = !isEditingRoutines)}
					>
						{isEditingRoutines ? 'Done' : 'Edit'}
					</button>
				{/if}
			</div>

			<!-- Routine list -->
			{#if $userData?.routines?.length}
				<div class="flex flex-col gap-2 pb-16">
					{#each $userData.routines! as routine}
						{@const stats = getRoutineStats(routine)}
						{@const routineExCount = getRoutineExercises(routine).length}
						<a
							href={'/routines/' + routine.id}
							onclick={isEditingRoutines
								? (e) => {
										e.preventDefault();
										handleRoutineEditClick(routine);
									}
								: undefined}
							class="bg-base-200 hover:bg-base-300 relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5 transition-colors active:scale-[0.98]"
						>
							<!-- Content -->
							<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
								<div class="flex items-center gap-2">
									<span class="truncate font-semibold">{routine.name}</span>
									{#if stats.doneToday > 0}
										<span class="badge badge-success badge-xs shrink-0">
											{stats.doneToday}/{routineExCount} today
										</span>
									{:else if routineExCount > 0}
										<span class="badge badge-ghost badge-xs shrink-0">
											{routineExCount}
											{routineExCount === 1 ? 'exercise' : 'exercises'}
										</span>
									{/if}
								</div>
								<div
									class="grid transition-all duration-200 ease-out"
									style:grid-template-rows={isEditingRoutines ? '0fr' : '1fr'}
									style:opacity={isEditingRoutines ? '0' : '1'}
								>
									<div class="overflow-hidden">
										<div class="text-base-content/40 flex items-center gap-1.5 text-xs">
											{#if stats.doneToday > 0}
												<span
													>{stats.doneToday} of {getRoutineExercises(routine).length} done today</span
												>
											{:else if stats.lastSession}
												<span
													>Last: {formatDistanceToNow(stats.lastSession, { addSuffix: true })}</span
												>
											{:else}
												<span>Not started yet</span>
											{/if}
										</div>
									</div>
								</div>
							</div>
							<!-- Chevron / Edit icon overlay -->
							<div class="relative h-4 w-4 shrink-0">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="text-base-content/30 absolute inset-0 h-4 w-4 transition-opacity duration-200"
									style:opacity={isEditingRoutines ? '0' : '1'}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2.5"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
								</svg>
								<span
									class="text-primary absolute inset-0 flex items-center justify-center transition-opacity duration-200 [&>svg]:h-4 [&>svg]:w-4"
									style:opacity={isEditingRoutines ? '1' : '0'}
								>
									{@html EditIcon}
								</span>
							</div>
						</a>
					{/each}
				</div>
			{:else if $user}
				<!-- Empty state -->
				<div class="flex flex-col items-center gap-4 py-20 text-center">
					<div class="bg-base-200 rounded-full p-6">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="text-base-content/40 h-10 w-10"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"
							/>
						</svg>
					</div>
					<div>
						<p class="font-semibold">No routines yet</p>
						<p class="text-base-content/50 mt-1 max-w-xs text-sm">
							Group exercises into routines to follow structured workout plans.
						</p>
					</div>
					<button class="btn btn-primary" onclick={handleAddRoutineClick}>
						{@html AddIcon} Create your first routine
					</button>
				</div>
			{/if}
		</div>
	{/if}
</PullToRefresh>

<NewRoutineSheet
	bind:open={showNewRoutineSheet}
	bind:newRoutineName
	onSave={handleNewRoutineSave}
/>

<EditRoutineSheet
	bind:open={showEditRoutineSheet}
	bind:name={editedRoutineName}
	{editingRoutine}
	onSave={handleEditRoutineSave}
	onDelete={handleEditRoutineDelete}
/>

<FAB onclick={handleAddRoutineClick} hidden={isEditingRoutines} />
