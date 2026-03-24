<script lang="ts">
	import { user, userData, db } from '$lib/firebase';
	import { type Routine, type Workout } from '$lib/state.svelte';
	import { v4 as uuidv4 } from 'uuid';
	import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
	import { formatDistanceToNow } from 'date-fns';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import AddIcon from '$lib/icons/add.svg?raw';
	import NewRoutineDialog from '../NewRoutineDialog.svelte';
	import EditRoutineDialog from '../EditRoutineDialog.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';

	let newRoutineDialog: HTMLDialogElement = $state()!;
	let newRoutineNameInputEle: HTMLInputElement = $state()!;
	let editRoutineDialog: HTMLDialogElement = $state()!;
	let editRoutineInputEle: HTMLInputElement = $state()!;
	let newRoutineName = $state('');
	let editedRoutineName = $state('');
	let editingRoutine: Routine | undefined = $state(undefined);

	function getRoutineStats(routine: Routine) {
		const workouts = (routine.workoutIds ?? [])
			.map((id) => $userData?.workouts.find((w) => w.id === id))
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
		newRoutineDialog?.showModal();
	}

	async function handleNewRoutineDialogResult() {
		if (!$userData) return;
		if (newRoutineDialog?.returnValue === 'add') {
			const userRef = doc(db, 'users', $user!.uid);
			const newRoutine: Routine = { id: uuidv4(), name: newRoutineName, workoutIds: [] };
			try {
				await updateDoc(userRef, { routines: arrayUnion(newRoutine) });
				newRoutineName = '';
			} catch (error) {
				console.error('Failed to create routine:', error);
			}
		}
	}

	async function handleRoutineEditClick(routine: Routine) {
		editingRoutine = routine;
		editRoutineDialog?.showModal();
	}

	async function handleEditRoutineResult() {
		if (!$userData) return;
		const routines = $userData.routines ?? [];
		const routineIndex = routines.findIndex((r) => r.id === editingRoutine?.id);
		const userRef = doc(db, 'users', $user!.uid);
		if (editRoutineDialog?.returnValue === 'edit') {
			const originalName = routines[routineIndex].name;
			routines[routineIndex].name = editedRoutineName;
			try {
				await updateDoc(userRef, { routines });
			} catch (error) {
				routines[routineIndex].name = originalName;
				console.error('Failed to update routine:', error);
			}
		} else if (editRoutineDialog?.returnValue === 'delete') {
			const deleted = routines.splice(routineIndex, 1)[0];
			try {
				await updateDoc(userRef, { routines });
			} catch (error) {
				routines.splice(routineIndex, 0, deleted);
				console.error('Failed to delete routine:', error);
			}
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
				<div class="skeleton h-9 w-32 rounded-xl"></div>
			</div>
			{#each { length: 3 } as _}
				<div class="skeleton h-20 w-full rounded-2xl"></div>
			{/each}
		</div>
	{:else}
		<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
			<!-- Header -->
			<div class="flex items-center justify-between">
				<h1 class="text-xl font-bold">Routines</h1>
				{#if $user}
					<button class="btn btn-primary btn-sm gap-1" onclick={handleAddRoutineClick}>
						{@html AddIcon} New routine
					</button>
				{/if}
			</div>

			<!-- Routine list -->
			{#if $userData?.routines?.length}
				<div class="flex flex-col gap-2">
					{#each $userData.routines! as routine}
						{@const stats = getRoutineStats(routine)}
						<div class="bg-base-200 flex items-center gap-2 rounded-2xl px-4 py-3.5">
							<a href={'/routines/' + routine.id} class="flex min-w-0 flex-1 flex-col gap-1">
								<div class="flex items-center gap-2">
									<span class="truncate font-semibold">{routine.name}</span>
									{#if stats.doneToday > 0}
										<span class="badge badge-success badge-xs shrink-0">
											{stats.doneToday}/{routine.workoutIds.length} today
										</span>
									{:else if routine.workoutIds.length > 0}
										<span class="badge badge-ghost badge-xs shrink-0">
											{routine.workoutIds.length}
											{routine.workoutIds.length === 1 ? 'exercise' : 'exercises'}
										</span>
									{/if}
								</div>
								<div class="text-base-content/40 flex items-center gap-1.5 text-xs">
									{#if stats.doneToday > 0}
										<span>{stats.doneToday} of {routine.workoutIds.length} done today</span>
									{:else if stats.lastSession}
										<span>Last: {formatDistanceToNow(stats.lastSession, { addSuffix: true })}</span>
									{:else}
										<span>Not started yet</span>
									{/if}
								</div>
							</a>
							<!-- Options menu -->
							<div class="dropdown dropdown-end">
								<button
									tabindex="0"
									class="btn btn-ghost btn-circle btn-sm"
									aria-label="Routine options">&#8226;&#8226;&#8226;</button
								>
								<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
								<ul
									tabindex="0"
									class="menu dropdown-content bg-base-100 rounded-box z-50 w-36 p-1 shadow"
								>
									<li>
										<button onclick={() => handleRoutineEditClick(routine)}>
											{@html EditIcon} Edit
										</button>
									</li>
								</ul>
							</div>
						</div>
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

<NewRoutineDialog
	bind:dialog={newRoutineDialog}
	bind:inputEle={newRoutineNameInputEle}
	bind:newRoutineName
	onclose={handleNewRoutineDialogResult}
/>

<EditRoutineDialog
	bind:dialog={editRoutineDialog}
	bind:name={editedRoutineName}
	bind:inputEle={editRoutineInputEle}
	onclose={handleEditRoutineResult}
	{editingRoutine}
/>
