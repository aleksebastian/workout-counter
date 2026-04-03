<script lang="ts">
	import { page } from '$app/state';
	import { db, userData, user } from '$lib/firebase';
	import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
	import { v4 as uuidv4 } from 'uuid';
	import { formatDistanceToNow } from 'date-fns';
	import BackButton from '$lib/components/Buttons/BackButton.svelte';
	import AddIcon from '$lib/icons/add.svg?raw';
	import UpIcon from '$lib/icons/up.svg?raw';
	import DownIcon from '$lib/icons/down.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import RemoveIcon from '$lib/icons/remove.svg?raw';
	import type { Workout, RoutineExercise } from '$lib/state.svelte';
	import { getRoutineExercises } from '$lib/state.svelte';
	import { getWorkoutNameValidationMsg } from '$lib/utils';

	let routine = $derived($userData?.routines?.find((r) => r.id === page.params.routineId));

	// Source of truth: exercises array
	let routineExercises = $derived(
		routine ? getRoutineExercises(routine) : ([] as RoutineExercise[])
	);

	let workoutsInRoutine = $derived(
		routineExercises
			.map((ex) => ({
				ex,
				workout: $userData?.workouts.find((w) => w.id === ex.workoutId)
			}))
			.filter((item) => item.workout !== undefined) as { ex: RoutineExercise; workout: Workout }[]
	);

	let workoutsNotInRoutine = $derived(
		($userData?.workouts ?? []).filter((w) => !routineExercises.some((ex) => ex.workoutId === w.id))
	);

	let weightUnit = $derived($userData?.preferences?.weightUnit ?? 'lbs');

	let doneToday = $derived(
		workoutsInRoutine.filter(({ workout }) =>
			workout.sets.some((s) => new Date(s.date).toDateString() === new Date().toDateString())
		).length
	);

	let totalSets = $derived(
		workoutsInRoutine.reduce((sum, { workout }) => sum + workout.sets.length, 0)
	);

	let lastRoutineDate = $derived(
		(() => {
			const times = workoutsInRoutine.flatMap(({ workout }) =>
				workout.sets.map((s) => new Date(s.date).getTime())
			);
			return times.length ? new Date(Math.max(...times)) : null;
		})()
	);

	let nextWorkout = $derived(
		(() => {
			if (!workoutsInRoutine.length) return undefined;
			const today = new Date().toDateString();
			const notDoneToday = workoutsInRoutine.filter(
				({ workout }) => !workout.sets.some((s) => new Date(s.date).toDateString() === today)
			);
			const pool = notDoneToday.length ? notDoneToday : workoutsInRoutine;
			return pool.reduce((oldest, item) => {
				if (!item.workout.sets.length) return item;
				if (!oldest.workout.sets.length) return oldest;
				const lastW = Math.max(...item.workout.sets.map((s) => new Date(s.date).getTime()));
				const lastO = Math.max(...oldest.workout.sets.map((s) => new Date(s.date).getTime()));
				return lastW < lastO ? item : oldest;
			}).workout;
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

	// New exercise inline creation
	let showNewExerciseInput = $state(false);
	let newExerciseName = $state('');
	let newExerciseError = $state('');
	let newExerciseInput: HTMLInputElement | undefined = $state();
	let exerciseSearch = $state('');

	let filteredWorkoutsNotInRoutine = $derived(
		exerciseSearch.trim()
			? workoutsNotInRoutine.filter((w) =>
					w.name.toLowerCase().includes(exerciseSearch.toLowerCase())
				)
			: workoutsNotInRoutine
	);

	$effect(() => {
		if (showNewExerciseInput) {
			queueMicrotask(() => newExerciseInput?.focus());
		} else {
			newExerciseName = '';
			newExerciseError = '';
		}
	});

	function buildUpdatedRoutine(exercises: RoutineExercise[]) {
		return { ...routine!, exercises };
	}

	async function saveRoutines(exercises: RoutineExercise[]) {
		if (!$userData || !routine) return;
		const updated = buildUpdatedRoutine(exercises);
		const routines = $userData.routines!.map((r) => (r.id === routine!.id ? updated : r));
		const userRef = doc(db, 'users', $user!.uid);
		await updateDoc(userRef, { routines });
	}

	async function handleCreateAndAddExercise() {
		const trimmed = newExerciseName.trim();
		const validationError = getWorkoutNameValidationMsg(trimmed, $userData?.workouts);
		if (validationError) {
			newExerciseError = validationError;
			return;
		}
		if (!routine || !$userData) return;

		const newWorkout = { id: uuidv4(), name: trimmed, sets: [] };
		const newExercises = [...routineExercises, { workoutId: newWorkout.id }];
		const userRef = doc(db, 'users', $user!.uid);

		try {
			await updateDoc(userRef, {
				workouts: arrayUnion(newWorkout),
				routines: $userData.routines!.map((r) =>
					r.id === routine!.id ? buildUpdatedRoutine(newExercises) : r
				)
			});
			showNewExerciseInput = false;
		} catch (error) {
			console.error('Failed to create exercise:', error);
			newExerciseError = 'Failed to save. Try again.';
		}
	}

	async function handleRemoveWorkout(workoutId: string) {
		const original = [...routineExercises];
		const updated = routineExercises.filter((ex) => ex.workoutId !== workoutId);
		// optimistic
		routine!.exercises = updated;
		try {
			await saveRoutines(updated);
		} catch {
			routine!.exercises = original;
		}
	}

	async function handleAddWorkout() {
		if (!routine || !selectedWorkoutId) return;
		const updated = [...routineExercises, { workoutId: selectedWorkoutId }];
		selectedWorkoutId = '';
		routine!.exercises = updated;
		try {
			await saveRoutines(updated);
		} catch {
			// revert by removing last
			routine!.exercises = updated.slice(0, -1);
		}
	}

	async function handleMoveUp(index: number) {
		if (!routine || index === 0) return;
		const exercises = [...routineExercises];
		[exercises[index - 1], exercises[index]] = [exercises[index], exercises[index - 1]];
		routine!.exercises = exercises;
		try {
			await saveRoutines(exercises);
		} catch {
			const reverted = [...routineExercises];
			[reverted[index - 1], reverted[index]] = [reverted[index], reverted[index - 1]];
			routine!.exercises = reverted;
		}
	}

	async function handleMoveDown(index: number) {
		if (!routine || index >= routineExercises.length - 1) return;
		const exercises = [...routineExercises];
		[exercises[index], exercises[index + 1]] = [exercises[index + 1], exercises[index]];
		routine!.exercises = exercises;
		try {
			await saveRoutines(exercises);
		} catch {
			const reverted = [...routineExercises];
			[reverted[index], reverted[index + 1]] = [reverted[index + 1], reverted[index]];
			routine!.exercises = reverted;
		}
	}

	async function handleUpdateTargetSets(workoutId: string, delta: number) {
		if (!routine) return;
		const exercises = routineExercises.map((ex) => {
			if (ex.workoutId !== workoutId) return ex;
			const current = ex.targetSets;
			if (delta < 0 && current === undefined) return ex; // already free-form
			const next = current === undefined ? 1 : Math.max(1, Math.min(99, current + delta));
			return { ...ex, targetSets: next };
		});
		routine!.exercises = exercises;
		try {
			await saveRoutines(exercises);
		} catch {
			/* leave optimistic state */
		}
	}

	async function handleUpdateRepRange(
		workoutId: string,
		field: 'minReps' | 'maxReps',
		delta: number
	) {
		if (!routine) return;
		const exercises = routineExercises.map((ex) => {
			if (ex.workoutId !== workoutId) return ex;
			const current = ex[field] ?? (field === 'minReps' ? 1 : 12);
			const next = Math.max(1, Math.min(99, current + delta));
			// Ensure min <= max
			if (field === 'minReps' && ex.maxReps !== undefined && next > ex.maxReps) {
				return { ...ex, minReps: next, maxReps: next };
			}
			if (field === 'maxReps' && ex.minReps !== undefined && next < ex.minReps) {
				return { ...ex, minReps: next, maxReps: next };
			}
			return { ...ex, [field]: next };
		});
		routine!.exercises = exercises;
		try {
			await saveRoutines(exercises);
		} catch {
			/* leave optimistic state */
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
			<div class="w-14">
				<BackButton />
			</div>
			<div class="text-center">
				<h1 class="text-xl leading-tight font-bold">{routine.name}</h1>
				<p class="text-base-content/50 text-xs">
					{workoutsInRoutine.length} exercise{workoutsInRoutine.length !== 1 ? 's' : ''}
				</p>
			</div>
			<button
				class="btn btn-ghost btn-sm w-14 font-semibold"
				class:text-primary={isEditing}
				class:text-base-content={!isEditing}
				onclick={() => (isEditing = !isEditing)}
				aria-label={isEditing ? 'Done editing' : 'Edit routine'}
			>
				{isEditing ? 'Done' : 'Edit'}
			</button>
		</div>

		{#if !isEditing && workoutsInRoutine.length > 0}
			<!-- Context strip -->
			<div class="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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
				{#each workoutsInRoutine as item, i}
					{@const ex = item.ex}
					{@const workout = item.workout}
					{#if isEditing}
						<div class="bg-base-200 flex flex-col gap-3 rounded-2xl px-4 py-3">
							<!-- Row 1: number + name + delete -->
							<div class="flex items-center gap-2">
								<span class="text-base-content/40 w-5 shrink-0 text-right text-xs">{i + 1}</span>
								<span class="min-w-0 flex-1 text-sm leading-snug font-semibold">{workout.name}</span
								>
								<div class="flex gap-0.5">
									<button
										class="btn btn-circle btn-ghost btn-sm"
										disabled={i === 0}
										onclick={() => handleMoveUp(i)}
										aria-label="Move up">{@html UpIcon}</button
									>
									<button
										class="btn btn-circle btn-ghost btn-sm"
										disabled={i === workoutsInRoutine.length - 1}
										onclick={() => handleMoveDown(i)}
										aria-label="Move down">{@html DownIcon}</button
									>
									<button
										class="btn btn-circle btn-ghost btn-sm text-error"
										onclick={() => handleRemoveWorkout(workout.id)}
										aria-label="Remove from routine">{@html DeleteIcon}</button
									>
								</div>
							</div>
							<!-- Row 2: sets + rep range as two clear columns -->
							<div class="grid grid-cols-2 gap-2 pl-7">
								<!-- Sets -->
								<div class="bg-base-300 flex flex-col items-center gap-1 rounded-xl py-2">
									<span
										class="text-base-content/40 text-[9px] font-semibold tracking-widest uppercase"
										>Sets</span
									>
									<div class="flex items-center gap-2">
										<button
											class="btn btn-circle btn-ghost btn-xs"
											onclick={() => handleUpdateTargetSets(workout.id, -1)}
											aria-label="Decrease target sets">{@html RemoveIcon}</button
										>
										<span class="text-base-content w-6 text-center text-sm font-bold tabular-nums">
											{ex.targetSets ?? '—'}
										</span>
										<button
											class="btn btn-circle btn-ghost btn-xs"
											onclick={() => handleUpdateTargetSets(workout.id, 1)}
											aria-label="Increase target sets">{@html AddIcon}</button
										>
									</div>
								</div>
								<!-- Rep range: explicit min/max rows -->
								<div class="bg-base-300 flex flex-col gap-1.5 rounded-xl px-3 py-2">
									<span
										class="text-base-content/40 text-center text-[9px] font-semibold tracking-widest uppercase"
										>Rep range</span
									>
									<div class="flex items-center gap-2">
										<span
											class="text-base-content/40 w-6 text-right text-[9px] font-semibold uppercase"
											>Min</span
										>
										<button
											class="btn btn-circle btn-ghost btn-xs"
											onclick={() => handleUpdateRepRange(workout.id, 'minReps', -1)}
											aria-label="Decrease min reps">{@html RemoveIcon}</button
										>
										<span class="text-base-content w-6 text-center text-sm font-bold tabular-nums">
											{ex.minReps ?? '—'}
										</span>
										<button
											class="btn btn-circle btn-ghost btn-xs"
											onclick={() => handleUpdateRepRange(workout.id, 'minReps', 1)}
											aria-label="Increase min reps">{@html AddIcon}</button
										>
									</div>
									<div class="flex items-center gap-2">
										<span
											class="text-base-content/40 w-6 text-right text-[9px] font-semibold uppercase"
											>Max</span
										>
										<button
											class="btn btn-circle btn-ghost btn-xs"
											onclick={() => handleUpdateRepRange(workout.id, 'maxReps', -1)}
											aria-label="Decrease max reps">{@html RemoveIcon}</button
										>
										<span class="text-base-content w-6 text-center text-sm font-bold tabular-nums">
											{ex.maxReps ?? '—'}
										</span>
										<button
											class="btn btn-circle btn-ghost btn-xs"
											onclick={() => handleUpdateRepRange(workout.id, 'maxReps', 1)}
											aria-label="Increase max reps">{@html AddIcon}</button
										>
									</div>
								</div>
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
							<span class="text-base-content/40 w-5 shrink-0 text-right text-xs font-medium"
								>{i + 1}</span
							>
							<div class="flex min-w-0 flex-1 flex-col gap-1">
								<div class="flex items-center gap-2">
									<span class="truncate text-sm font-semibold">{workout.name}</span>
									{#if doneNow}
										<span class="badge badge-success badge-xs shrink-0">Today</span>
									{/if}
								</div>
								<!-- Target sets and rep range -->
								<div class="flex flex-wrap items-center gap-1.5">
									{#if ex.targetSets}
										<span class="badge badge-sm badge-outline font-medium"
											>{ex.targetSets} sets</span
										>
									{/if}
									{#if ex.minReps || ex.maxReps}
										<span class="badge badge-sm badge-outline font-medium">
											{ex.minReps ?? '?'}–{ex.maxReps ?? '?'} reps
										</span>
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
												{lastSet.weight}
												{weightUnit}
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
			<div class="bg-base-200 flex flex-col gap-3 rounded-2xl p-4">
				<p class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">
					Add exercise
				</p>

				{#if workoutsNotInRoutine.length > 4}
					<input
						type="search"
						placeholder="Search exercises…"
						class="input input-sm input-bordered w-full"
						bind:value={exerciseSearch}
					/>
				{/if}

				{#if workoutsNotInRoutine.length}
					<div class="flex flex-wrap gap-2">
						{#each filteredWorkoutsNotInRoutine as workout}
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
						{#if filteredWorkoutsNotInRoutine.length === 0}
							<p class="text-base-content/40 text-sm">No matches.</p>
						{/if}
					</div>
				{:else if !showNewExerciseInput}
					<p class="text-base-content/40 text-sm">All exercises are already in this routine.</p>
				{/if}

				{#if showNewExerciseInput}
					<div class="flex flex-col gap-2">
						<div class="flex gap-2">
							<input
								bind:this={newExerciseInput}
								bind:value={newExerciseName}
								type="text"
								placeholder="Exercise name"
								class="input input-bordered input-sm flex-1"
								class:input-error={!!newExerciseError}
								onkeydown={(e) => {
									if (e.key === 'Enter') handleCreateAndAddExercise();
									if (e.key === 'Escape') showNewExerciseInput = false;
								}}
								oninput={() => (newExerciseError = '')}
							/>
							<button class="btn btn-primary btn-sm" onclick={handleCreateAndAddExercise}
								>Add</button
							>
							<button class="btn btn-ghost btn-sm" onclick={() => (showNewExerciseInput = false)}
								>Cancel</button
							>
						</div>
						{#if newExerciseError}
							<p class="text-error text-xs">
								{newExerciseError}
							</p>
						{/if}
					</div>
				{:else}
					<button
						class="btn btn-outline btn-primary btn-sm self-start"
						onclick={() => (showNewExerciseInput = true)}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							height="16"
							width="16"
							viewBox="0 -960 960 960"
							fill="currentColor"
							><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" /></svg
						>
						New exercise
					</button>
				{/if}
			</div>
		{/if}
	</div>{/if}
