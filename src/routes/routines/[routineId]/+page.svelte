<script lang="ts">
	import { page } from '$app/state';
	import { db, userData, user } from '$lib/firebase';
	import { doc, updateDoc } from 'firebase/firestore';
	import { formatDistanceToNow } from 'date-fns';
	import BackButton from '$lib/components/Buttons/BackButton.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import AddIcon from '$lib/icons/add.svg?raw';
	import UpIcon from '$lib/icons/up.svg?raw';
	import DownIcon from '$lib/icons/down.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import type { Workout } from '$lib/state.svelte';

	let routine = $derived($userData?.routines?.find((r) => r.id === page.params.routineId));

	let workoutsInRoutine = $derived(
		(routine?.workoutIds ?? [])
			.map((id) => $userData?.workouts.find((w) => w.id === id))
			.filter(Boolean) as import('$lib/state.svelte').Workout[]
	);

	let workoutsNotInRoutine = $derived(
		($userData?.workouts ?? []).filter((w) => !routine?.workoutIds.includes(w.id))
	);

	let weightUnit = $derived($userData?.preferences?.weightUnit ?? 'lbs');

	let doneToday = $derived(
		workoutsInRoutine.filter((w) =>
			w.sets.some((s) => new Date(s.date).toDateString() === new Date().toDateString())
		).length
	);

	let totalSets = $derived(workoutsInRoutine.reduce((sum, w) => sum + w.sets.length, 0));

	let lastRoutineDate = $derived(
		(() => {
			const times = workoutsInRoutine.flatMap((w) =>
				w.sets.map((s) => new Date(s.date).getTime())
			);
			return times.length ? new Date(Math.max(...times)) : null;
		})()
	);

	let nextWorkout = $derived(
		(() => {
			if (!workoutsInRoutine.length) return undefined;
			const today = new Date().toDateString();
			const notDoneToday = workoutsInRoutine.filter(
				(w) => !w.sets.some((s) => new Date(s.date).toDateString() === today)
			);
			const pool = notDoneToday.length ? notDoneToday : workoutsInRoutine;
			return pool.reduce((oldest, w) => {
				if (!w.sets.length) return w;
				if (!oldest.sets.length) return oldest;
				const lastW = Math.max(...w.sets.map((s) => new Date(s.date).getTime()));
				const lastO = Math.max(...oldest.sets.map((s) => new Date(s.date).getTime()));
				return lastW < lastO ? w : oldest;
			});
		})()
	);

	function getLastSet(workout: Workout) {
		if (!workout.sets.length) return undefined;
		return workout.sets.reduce((latest, s) =>
			new Date(s.date) > new Date(latest.date) ? s : latest
		);
	}

	let selectedWorkoutId = $state('');
	let isEditing = $state(false);

	async function saveRoutines() {
		if (!$userData || !routine) return;
		const routines = $userData.routines!.map((r) => (r.id === routine!.id ? routine! : r));
		const userRef = doc(db, 'users', $user!.uid);
		await updateDoc(userRef, { routines });
	}

	async function handleRemoveWorkout(workoutId: string) {
		if (!routine) return;
		const original = [...routine.workoutIds];
		routine.workoutIds = routine.workoutIds.filter((id) => id !== workoutId);
		try {
			await saveRoutines();
		} catch (error) {
			routine.workoutIds = original;
			console.error('Failed to remove workout from routine:', error);
		}
	}

	async function handleAddWorkout() {
		if (!routine || !selectedWorkoutId) return;
		const original = [...routine.workoutIds];
		routine.workoutIds = [...routine.workoutIds, selectedWorkoutId];
		selectedWorkoutId = '';
		try {
			await saveRoutines();
		} catch (error) {
			routine.workoutIds = original;
			console.error('Failed to add workout to routine:', error);
		}
	}

	async function handleMoveUp(index: number) {
		if (!routine || index === 0) return;
		const original = [...routine.workoutIds];
		const ids = [...routine.workoutIds];
		[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
		routine.workoutIds = ids;
		try {
			await saveRoutines();
		} catch (error) {
			routine.workoutIds = original;
			console.error('Failed to reorder routine:', error);
		}
	}

	async function handleMoveDown(index: number) {
		if (!routine || index >= routine.workoutIds.length - 1) return;
		const original = [...routine.workoutIds];
		const ids = [...routine.workoutIds];
		[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
		routine.workoutIds = ids;
		try {
			await saveRoutines();
		} catch (error) {
			routine.workoutIds = original;
			console.error('Failed to reorder routine:', error);
		}
	}
</script>

{#if !$userData}
	<!-- Skeleton -->
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<div class="flex w-full items-center justify-between">
			<div class="skeleton h-10 w-10 rounded-full"></div>
			<div class="skeleton h-7 w-40 rounded-lg"></div>
			<div class="skeleton h-10 w-10 rounded-full"></div>
		</div>
		<div class="skeleton h-10 w-full rounded-xl"></div>
		<div class="skeleton h-14 w-full rounded-2xl"></div>
		{#each { length: 3 } as _}
			<div class="skeleton h-20 w-full rounded-2xl"></div>
		{/each}
	</div>
{:else if routine}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<BackButton />
			<div class="text-center">
				<h1 class="text-xl font-bold leading-tight">{routine.name}</h1>
				<p class="text-base-content/50 text-xs">
					{workoutsInRoutine.length} exercise{workoutsInRoutine.length !== 1 ? 's' : ''}
				</p>
			</div>
			<button
				class="btn btn-square btn-ghost"
				onclick={() => (isEditing = !isEditing)}
				aria-label={isEditing ? 'Done editing' : 'Edit routine'}
			>
				{#if isEditing}
					<span class="text-primary text-sm font-semibold">Done</span>
				{:else}
					{@html EditIcon}
				{/if}
			</button>
		</div>

		{#if !isEditing && workoutsInRoutine.length > 0}
			<!-- Context strip -->
			<div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
				<div class="bg-base-200 flex-none rounded-xl px-4 py-2.5 text-center">
					<p class="text-base-content/50 text-xs">Today</p>
					<p class="text-sm font-semibold">{doneToday}/{workoutsInRoutine.length}</p>
				</div>
				{#if lastRoutineDate}
					<div class="bg-base-200 flex-none rounded-xl px-4 py-2.5 text-center">
						<p class="text-base-content/50 text-xs">Last session</p>
						<p class="text-sm font-semibold">
							{formatDistanceToNow(lastRoutineDate, { addSuffix: true })}
						</p>
					</div>
				{/if}
				{#if totalSets > 0}
					<div class="bg-base-200 flex-none rounded-xl px-4 py-2.5 text-center">
						<p class="text-base-content/50 text-xs">Total sets</p>
						<p class="text-sm font-semibold">{totalSets}</p>
					</div>
				{/if}
			</div>

			<!-- Start / Continue CTA -->
			{#if nextWorkout}
				<a
					href={`/workout/${nextWorkout.id}?from=/routines/${routine.id}`}
					class="btn btn-primary btn-lg w-full"
				>
					{doneToday === workoutsInRoutine.length ? 'Do again — ' : 'Start — '}{nextWorkout.name}
				</a>
			{/if}
		{/if}

		<!-- Workout list -->
		{#if workoutsInRoutine.length}
			<div class="flex flex-col gap-2">
				{#each workoutsInRoutine as workout, i}
					{#if isEditing}
						<div class="bg-base-200 flex items-center gap-2 rounded-2xl px-3 py-2">
							<span class="text-base-content/40 w-5 shrink-0 text-right text-xs">{i + 1}</span>
							<span class="min-w-0 flex-1 truncate text-sm font-medium">{workout.name}</span>
							<div class="flex gap-0.5">
								<button
									class="btn btn-circle btn-ghost btn-sm"
									disabled={i === 0}
									onclick={() => handleMoveUp(i)}
									aria-label="Move up"
								>{@html UpIcon}</button>
								<button
									class="btn btn-circle btn-ghost btn-sm"
									disabled={i === workoutsInRoutine.length - 1}
									onclick={() => handleMoveDown(i)}
									aria-label="Move down"
								>{@html DownIcon}</button>
								<button
									class="btn btn-circle btn-ghost btn-sm text-error"
									onclick={() => handleRemoveWorkout(workout.id)}
									aria-label="Remove from routine"
								>{@html DeleteIcon}</button>
							</div>
						</div>
					{:else}
						{@const lastSet = getLastSet(workout)}
						{@const doneNow = workout.sets.some(
							(s) => new Date(s.date).toDateString() === new Date().toDateString()
						)}
						<a
							class="bg-base-200 hover:bg-base-300 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 transition-colors active:scale-[0.99]"
							href={`/workout/${workout.id}?from=/routines/${routine.id}`}
						>
							<span class="text-base-content/40 w-5 shrink-0 text-right text-xs font-medium">{i + 1}</span>
							<div class="flex min-w-0 flex-1 flex-col gap-1">
								<div class="flex items-center gap-2">
									<span class="truncate text-sm font-semibold">{workout.name}</span>
									{#if doneNow}
										<span class="badge badge-success badge-xs shrink-0">Today</span>
									{/if}
								</div>
								{#if lastSet}
									<div class="flex flex-wrap items-center gap-1.5">
										<span class="text-base-content/50 text-xs">
											{formatDistanceToNow(new Date(lastSet.date), { addSuffix: true })}
										</span>
										<span class="badge badge-sm badge-ghost font-medium">{lastSet.reps} reps</span>
										{#if lastSet.weight && lastSet.weight > 0}
											<span class="badge badge-sm badge-ghost font-medium">
												{lastSet.weight} {weightUnit}
											</span>
										{/if}
									</div>
								{:else}
									<span class="text-base-content/35 text-xs">Not done yet</span>
								{/if}
							</div>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-base-content/30 h-4 w-4 shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
							</svg>
						</a>
					{/if}
				{/each}
			</div>
		{:else if !isEditing}
			<!-- Empty state -->
			<div class="flex flex-col items-center gap-3 py-16 text-center">
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
							d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
						/>
					</svg>
				</div>
				<p class="font-semibold">No exercises yet</p>
				<p class="text-base-content/50 max-w-xs text-sm">
					Tap the edit icon above to add exercises to this routine.
				</p>
				<button class="btn btn-primary btn-sm mt-1" onclick={() => (isEditing = true)}>
					{@html AddIcon} Add exercises
				</button>
			</div>
		{/if}

		<!-- Add workout panel (edit mode) -->
		{#if isEditing}
			{#if workoutsNotInRoutine.length}
				<div class="bg-base-200 flex flex-col gap-3 rounded-2xl p-4">
					<p class="text-base-content/50 text-xs font-semibold uppercase tracking-widest">
						Add exercise
					</p>
					<div class="flex flex-wrap gap-2">
						{#each workoutsNotInRoutine as workout}
							<button
								class="btn btn-sm btn-ghost gap-1"
								onclick={() => {
									selectedWorkoutId = workout.id;
									handleAddWorkout();
								}}
							>
								<span class="text-base leading-none">+</span>{workout.name}
							</button>
						{/each}
					</div>
				</div>
			{:else if workoutsInRoutine.length > 0}
				<p class="text-base-content/40 text-center text-sm">All exercises are in this routine.</p>
			{/if}
		{/if}
	</div>
{/if}
