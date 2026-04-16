<script lang="ts">
	import { page } from '$app/state';
	import { db, userData, user } from '$lib/firebase';
	import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
	import { v4 as uuidv4 } from 'uuid';
	import { formatDistanceToNow } from 'date-fns';
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { HAPTIC } from '$lib/haptic';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import ExerciseSearch from '$lib/components/ExerciseSearch.svelte';
	import AddIcon from '$lib/icons/add.svg?raw';
	import CloseIcon from '$lib/icons/close.svg?raw';
	import RemoveIcon from '$lib/icons/remove.svg?raw';
	import MoreVertIcon from '$lib/icons/more_vert.svg?raw';
	import DragIndicatorIcon from '$lib/icons/drag_indicator.svg?raw';
	import CheckIcon from '$lib/icons/check.svg?raw';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import type { Workout, RoutineExercise } from '$lib/state.svelte';
	import { getRoutineExercises, navState } from '$lib/state.svelte';
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

	$effect(() => {
		navState.title = routine?.name ?? '';
		navState.backHref = '/';
		return () => {
			navState.title = '';
		};
	});

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

	function getLastSet(workout: Workout) {
		if (!workout.sets.length) return undefined;
		return workout.sets.reduce((latest, s) =>
			new Date(s.date) > new Date(latest.date) ? s : latest
		);
	}

	let selectedWorkoutId = $state('');
	let isEditing = $state(false);
	let showMenu = $state(false);
	let showReorderSheet = $state(false);

	// Confirmation dialog for removing workout from routine
	let removeConfirmDialog: HTMLDialogElement = $state()!;
	let workoutIdToRemove = $state<string | null>(null);

	// Reorder mode state
	let reorderList = $state<{ ex: RoutineExercise; workout: Workout }[]>([]);
	let draggedIndex = $state<number | null>(null);

	// Swipe to delete in reorder mode
	let swipeX: Record<string, number> = $state({});
	let swipeTouchStartX: Record<string, number> = {};
	const SWIPE_DELETE_THRESHOLD = 80;
	const SWIPE_REVEAL_THRESHOLD = 40;

	// New exercise inline creation
	let showNewExerciseInput = $state(false);
	let newExerciseName = $state('');
	let newExerciseError = $state('');
	let newExerciseInput: HTMLInputElement | undefined = $state();
	let exerciseSearch = $state('');

	$effect(() => {
		if (showNewExerciseInput) {
			queueMicrotask(() => newExerciseInput?.focus());
		} else {
			newExerciseName = '';
			newExerciseError = '';
		}
	});

	$effect(() => {
		// Prevent body scroll when reorder sheet or menu is open
		if (showReorderSheet || showMenu) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}

		// Cleanup on unmount
		return () => {
			document.body.style.overflow = '';
		};
	});

	// ── Reorder Mode Functions ─────────────────────────────────────────────────

	function openReorderMode() {
		reorderList = [...workoutsInRoutine];
		showReorderSheet = true;
		showMenu = false;
	}

	function closeReorderMode() {
		showReorderSheet = false;
		draggedIndex = null;
		swipeX = {};
		reorderList = [];
	}

	async function saveReorder() {
		const newExercises = reorderList.map((item) => ({ ...item.ex, workoutId: item.workout.id }));
		try {
			await saveRoutines(newExercises);
			closeReorderMode();
		} catch (error) {}
	}

	// Touch-based drag and drop for reordering
	let isDragging = false;
	let lastHoveredIndex: number | null = null;

	function handleDragStart(index: number) {
		// Prevent if swiping to delete
		if (swipeX[reorderList[index].workout.id]) return;

		draggedIndex = index;
		lastHoveredIndex = index;
		isDragging = true;
		HAPTIC.tap();
	}

	function handleDragMove(e: TouchEvent) {
		if (!isDragging || draggedIndex === null) return;

		const touch = e.touches[0];
		const elements = document.querySelectorAll('.reorder-item');

		// Find which element the touch is over
		let overIndex = -1;
		elements.forEach((el, idx) => {
			const rect = el.getBoundingClientRect();
			if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
				overIndex = idx;
			}
		});

		// If we found an element and it's different from last hover
		if (overIndex !== -1 && overIndex !== lastHoveredIndex && overIndex !== draggedIndex) {
			// Swap in array
			const newList = [...reorderList];
			const [draggedItem] = newList.splice(draggedIndex, 1);
			newList.splice(overIndex, 0, draggedItem);

			reorderList = newList;
			draggedIndex = overIndex;
			lastHoveredIndex = overIndex;
			HAPTIC.tap();
		}
	}

	function handleDragEnd() {
		if (!isDragging) {
			isDragging = false;
			draggedIndex = null;
			lastHoveredIndex = null;
			return;
		}

		isDragging = false;
		draggedIndex = null;
		lastHoveredIndex = null;
		HAPTIC.tap();
	}

	// Swipe to delete in reorder mode
	function onSwipeTouchStart(workoutId: string, e: TouchEvent) {
		swipeTouchStartX[workoutId] = e.touches[0].clientX;
	}

	function onSwipeTouchMove(workoutId: string, e: TouchEvent) {
		const dx = swipeTouchStartX[workoutId] - e.touches[0].clientX;
		if (dx > 0) {
			swipeX[workoutId] = Math.min(dx, SWIPE_DELETE_THRESHOLD + 20);
			if (Math.round(dx) === SWIPE_REVEAL_THRESHOLD) HAPTIC.tap();
		}
	}

	function onSwipeTouchEnd(workoutId: string) {
		const dx = swipeX[workoutId] ?? 0;
		if (dx >= SWIPE_DELETE_THRESHOLD) {
			swipeX[workoutId] = 0;
			workoutIdToRemove = workoutId;
			removeConfirmDialog.showModal();
		} else {
			swipeX[workoutId] = 0;
		}
	}

	// ── End Reorder Mode Functions ─────────────────────────────────────────────

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
			newExerciseError = 'Failed to save. Try again.';
		}
	}

	async function handleRemoveWorkout(workoutId: string) {
		// If in reorder mode, just update the reorder list
		if (showReorderSheet) {
			reorderList = reorderList.filter((item) => item.workout.id !== workoutId);
			return;
		}

		// Otherwise, remove from routine
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
			<p class="text-base-content/50 text-xs">
				{workoutsInRoutine.length} exercise{workoutsInRoutine.length !== 1 ? 's' : ''}
			</p>
			<button
				class="btn btn-circle btn-ghost btn-sm"
				onclick={() => {
					isEditing = false;
					showMenu = !showMenu;
				}}
				aria-label="More options"
			>
				{@html MoreVertIcon}
			</button>
		</div>

		{#if !isEditing && workoutsInRoutine.length > 0}
			<!-- Context strip -->
			<div class="scrollbar-none context-strip -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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
		{/if}

		<!-- Workout list -->
		{#if workoutsInRoutine.length}
			<div class="flex flex-col gap-2">
				{#each workoutsInRoutine as item, i (item.workout.id)}
					{@const ex = item.ex}
					{@const workout = item.workout}
					<div animate:flip={{ duration: 250, easing: cubicOut }}>
						{#if isEditing}
							{#key workout.id}
								<div
									class="bg-base-200 item-card fade-in flex flex-col gap-3 rounded-2xl px-4 py-3"
								>
									<!-- Row 1: number + name + controls -->
									<div class="flex items-center gap-2">
										<span class="text-base-content/40 w-5 shrink-0 text-right text-xs">{i + 1}</span
										>
										<span class="min-w-0 flex-1 text-sm leading-snug font-semibold"
											>{workout.name}</span
										>
										<button
											class="btn btn-circle btn-ghost btn-sm text-error smooth-hover"
											onclick={() => {
												workoutIdToRemove = workout.id;
												removeConfirmDialog.showModal();
											}}
											aria-label="Remove from routine">{@html CloseIcon}</button
										>
									</div>
									<!-- Row 2: sets + rep range -->
									<div class="mx-auto grid max-w-md grid-cols-2 gap-2">
										<!-- Sets -->
										<div class="bg-base-300 flex flex-col rounded-xl py-2.5">
											<span
												class="text-base-content/40 text-center text-[9px] font-semibold tracking-widest uppercase"
												>Sets</span
											>
											<div class="flex flex-1 items-center justify-center gap-2">
												<button
													class="btn btn-circle btn-ghost btn-xs smooth-hover"
													onclick={() => handleUpdateTargetSets(workout.id, -1)}
													aria-label="Decrease target sets">{@html RemoveIcon}</button
												>
												<span
													class="text-base-content w-8 text-center text-base font-bold tabular-nums"
												>
													{ex.targetSets ?? '—'}
												</span>
												<button
													class="btn btn-circle btn-ghost btn-xs smooth-hover"
													onclick={() => handleUpdateTargetSets(workout.id, 1)}
													aria-label="Increase target sets">{@html AddIcon}</button
												>
											</div>
										</div>
										<!-- Rep range -->
										<div class="bg-base-300 flex flex-col rounded-xl px-3 py-2">
											<span
												class="text-base-content/40 text-center text-[9px] font-semibold tracking-widest uppercase"
												>Rep range</span
											>
											<div class="flex flex-1 flex-col justify-center gap-1.5">
												<div class="flex items-center gap-1.5">
													<span
														class="text-base-content/40 w-6 shrink-0 text-right text-[9px] font-semibold uppercase"
														>Min</span
													>
													<button
														class="btn btn-circle btn-ghost btn-xs smooth-hover"
														onclick={() => handleUpdateRepRange(workout.id, 'minReps', -1)}
														aria-label="Decrease min reps">{@html RemoveIcon}</button
													>
													<span
														class="text-base-content w-6 text-center text-sm font-bold tabular-nums"
													>
														{ex.minReps ?? '—'}
													</span>
													<button
														class="btn btn-circle btn-ghost btn-xs smooth-hover"
														onclick={() => handleUpdateRepRange(workout.id, 'minReps', 1)}
														aria-label="Increase min reps">{@html AddIcon}</button
													>
												</div>
												<div class="flex items-center gap-1.5">
													<span
														class="text-base-content/40 w-6 shrink-0 text-right text-[9px] font-semibold uppercase"
														>Max</span
													>
													<button
														class="btn btn-circle btn-ghost btn-xs smooth-hover"
														onclick={() => handleUpdateRepRange(workout.id, 'maxReps', -1)}
														aria-label="Decrease max reps">{@html RemoveIcon}</button
													>
													<span
														class="text-base-content w-6 text-center text-sm font-bold tabular-nums"
													>
														{ex.maxReps ?? '—'}
													</span>
													<button
														class="btn btn-circle btn-ghost btn-xs smooth-hover"
														onclick={() => handleUpdateRepRange(workout.id, 'maxReps', 1)}
														aria-label="Increase max reps">{@html AddIcon}</button
													>
												</div>
											</div>
										</div>
									</div>
								</div>
							{/key}
						{:else}
							{@const lastSet = getLastSet(workout)}
							{@const doneNow = workout.sets.some(
								(s) => new Date(s.date).toDateString() === new Date().toDateString()
							)}
							{#key workout.id}
								<a
									class="bg-base-200 workout-link fade-in flex w-full items-center gap-3 rounded-2xl px-4 py-3.5"
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
										{#if ex.targetSets || ex.minReps || ex.maxReps}
											<div class="flex flex-wrap items-center gap-1.5">
												{#if ex.targetSets}
													<span class="badge badge-sm badge-outline font-medium"
														>{ex.targetSets} set{ex.targetSets > 1 ? 's' : ''}</span
													>
												{/if}
												{#if ex.minReps || ex.maxReps}
													<span class="badge badge-sm badge-outline font-medium">
														{ex.minReps ?? '?'}–{ex.maxReps ?? '?'} reps
													</span>
												{/if}
											</div>
										{/if}
										{#if lastSet}
											<div class="flex flex-wrap items-center gap-1.5">
												<span class="text-base-content/50 text-xs">
													{formatDistanceToNow(new Date(lastSet.date), { addSuffix: true })}
												</span>
												<span class="badge badge-sm badge-ghost font-medium"
													>{lastSet.reps} reps</span
												>
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
							{/key}
						{/if}
					</div>
				{/each}
			</div>
		{:else if !isEditing}
			<!-- Empty state -->
			<div class="fade-in flex flex-col items-center gap-3 py-16 text-center">
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
					Tap the Edit button above to add exercises to this routine.
				</p>
				<button class="btn btn-primary btn-sm mt-1" onclick={() => (isEditing = true)}>
					{@html AddIcon} Add exercises
				</button>
			</div>
		{/if}

		<!-- Add workout panel (edit mode) -->
		{#if isEditing}
			<div class="bg-base-200 add-panel flex flex-col gap-3 rounded-2xl p-4">
				<p class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">
					Add exercise
				</p>

				{#if !showNewExerciseInput}
					<ExerciseSearch
						exercises={workoutsNotInRoutine}
						bind:searchValue={exerciseSearch}
						onSelect={(workoutId) => {
							selectedWorkoutId = workoutId;
							handleAddWorkout();
						}}
						showCreateNew={true}
						onCreateNew={() => (showNewExerciseInput = true)}
					/>
				{/if}

				{#if showNewExerciseInput}
					<div class="fade-in-fast flex flex-col gap-2">
						<div class="flex gap-2">
							<input
								bind:this={newExerciseInput}
								bind:value={newExerciseName}
								type="text"
								placeholder="Exercise name"
								class="input input-bordered input-sm search-input flex-1"
								class:input-error={!!newExerciseError}
								onkeydown={(e) => {
									if (e.key === 'Enter') handleCreateAndAddExercise();
									if (e.key === 'Escape') showNewExerciseInput = false;
								}}
								oninput={() => (newExerciseError = '')}
							/>
							<button
								class="btn btn-primary btn-sm smooth-hover"
								onclick={handleCreateAndAddExercise}>Add</button
							>
							<button
								class="btn btn-ghost btn-sm smooth-hover"
								onclick={() => (showNewExerciseInput = false)}>Cancel</button
							>
						</div>
						{#if newExerciseError}
							<p class="text-error fade-in-fast text-xs">
								{newExerciseError}
							</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>{/if}

<ConfirmationDialog
	bind:dialog={removeConfirmDialog}
	header="Remove from routine?"
	content="This will only remove the exercise from this routine. The exercise itself won't be deleted."
	actionLabel="Remove"
	destructive={true}
	onclose={(e) => {
		const dialog = e.target as HTMLDialogElement;
		if (dialog.returnValue === 'default' && workoutIdToRemove) {
			handleRemoveWorkout(workoutIdToRemove);
		}
		workoutIdToRemove = null;
	}}
/>

<!-- Simple Dropdown Menu -->
{#if showMenu}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40"
		onclick={() => (showMenu = false)}
		onkeydown={(e) => e.key === 'Escape' && (showMenu = false)}
		role="button"
		tabindex="-1"
		aria-label="Close menu"
		transition:fade={{ duration: 150 }}
	></div>

	<!-- Dropdown Menu -->
	<div
		class="bg-base-100 fixed top-20 right-4 z-50 min-w-[200px] rounded-xl p-2 shadow-2xl"
		transition:fly={{ y: -10, duration: 200, easing: cubicOut }}
		role="menu"
	>
		<button
			class="hover:bg-base-200 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors"
			onclick={() => {
				showMenu = false;
				isEditing = true;
				HAPTIC.tap();
			}}
			role="menuitem"
		>
			<div class="text-base-content/60">{@html EditIcon}</div>
			<span>Edit exercises</span>
		</button>

		<button
			class="hover:bg-base-200 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors"
			onclick={openReorderMode}
			role="menuitem"
		>
			<div class="text-base-content/60">{@html DragIndicatorIcon}</div>
			<span>Reorder</span>
		</button>
	</div>
{/if}

<!-- Reorder Bottom Sheet -->
{#if showReorderSheet}
	<div class="fixed inset-0 z-50 flex items-end p-2">
		<!-- Backdrop -->
		<div
			class="absolute inset-0 bg-black/40 backdrop-blur-sm"
			transition:fade={{ duration: 200 }}
			onclick={closeReorderMode}
			role="presentation"
		></div>

		<!-- Sheet -->
		<div
			class="bg-base-100 relative flex w-full flex-col overflow-hidden rounded-3xl shadow-2xl"
			style="height: 90vh; padding-bottom: env(safe-area-inset-bottom, 0px)"
			transition:fly={{ y: 500, duration: 350, easing: cubicOut }}
			ontouchmove={handleDragMove}
			ontouchend={handleDragEnd}
			role="dialog"
			aria-label="Reorder exercises"
			tabindex="-1"
		>
			<!-- Drag Handle -->
			<div class="flex justify-center pt-3 pb-2">
				<div class="bg-base-content/20 h-1 w-10 rounded-full"></div>
			</div>

			<!-- Header -->
			<div class="border-base-300 flex items-center justify-between border-b px-4 py-3">
				<button
					class="btn btn-circle btn-ghost btn-sm"
					onclick={closeReorderMode}
					aria-label="Cancel"
				>
					{@html CloseIcon}
				</button>
				<h2 class="text-lg font-bold">Reorder</h2>
				<button
					class="btn btn-circle btn-ghost btn-sm text-success"
					onclick={saveReorder}
					aria-label="Save"
				>
					{@html CheckIcon}
				</button>
			</div>

			<!-- Reorderable List -->
			<div class="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
				{#each reorderList as item, i (item.workout.id)}
					{@const workout = item.workout}
					{@const swipeAmount = swipeX[workout.id] ?? 0}
					<div
						class="relative overflow-hidden rounded-2xl"
						style="transform: translateX(-{swipeAmount}px); transition: transform 0.1s ease-out;"
						data-workout-id={workout.id}
					>
						<!-- Delete background -->
						{#if swipeAmount > 0}
							<div
								class="bg-error absolute top-0 right-0 bottom-0 flex items-center justify-end pr-6"
								style="width: {swipeAmount}px"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</div>
						{/if}

						<!-- Item -->
						<div
							class="bg-base-200 reorder-item flex items-center gap-3 rounded-2xl px-4 py-4 transition-opacity"
							class:dragging={draggedIndex === i}
							role="button"
							tabindex="0"
							aria-label="Drag to reorder {workout.name}"
							data-workout-id={workout.id}
							ontouchstart={(e) => {
								// Check if touch started on drag handle
								const target = e.target as HTMLElement;
								if (target.closest('.drag-handle')) {
									handleDragStart(i);
								} else {
									onSwipeTouchStart(workout.id, e);
								}
							}}
							ontouchmove={(e) => {
								if (isDragging && draggedIndex === i) {
									onSwipeTouchMove(workout.id, e);
								}
							}}
							ontouchend={() => {
								if (!isDragging) {
									onSwipeTouchEnd(workout.id);
								}
							}}
						>
							<span class="text-base-content/40 w-6 shrink-0 text-right text-sm font-medium"
								>{i + 1}</span
							>
							<span class="min-w-0 flex-1 text-base font-semibold">{workout.name}</span>
							<div
								class="drag-handle text-base-content/40 -mr-2 cursor-grab p-2 active:cursor-grabbing"
							>
								{@html DragIndicatorIcon}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Pure CSS GPU-accelerated animations - 60fps guaranteed */
	/* All animations use only transform and opacity for maximum performance */

	.context-strip {
		animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.fade-in {
		animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.fade-in-fast {
		animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.item-card,
	.workout-link {
		will-change: auto; /* Only use will-change during animation */
		backface-visibility: hidden;
		-webkit-font-smoothing: antialiased;
		transform: translateZ(0); /* Force GPU layer */
	}

	.workout-link {
		transition:
			background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
			transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.workout-link:hover {
		background-color: oklch(var(--b3) / 1);
	}

	.workout-link:active {
		transform: scale(0.985) translateZ(0);
	}

	.smooth-hover {
		backface-visibility: hidden;
		transform: translateZ(0);
		transition:
			background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
			color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
			transform 0.12s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.smooth-hover:not(:disabled):hover {
		background-color: oklch(var(--b3) / 1);
	}

	.smooth-hover.text-error:not(:disabled):hover {
		background-color: oklch(var(--er) / 0.1);
	}

	.add-panel {
		animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.search-input {
		transition:
			border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.search-input:focus {
		box-shadow: 0 0 0 3px oklch(var(--p) / 0.2);
	}

	/* Reorder mode styles */
	.reorder-item {
		backface-visibility: hidden;
		transform: translateZ(0);
		transition:
			transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
			opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		user-select: none;
		-webkit-user-select: none;
		touch-action: none;
	}

	.reorder-item.dragging {
		opacity: 0.5;
		transform: scale(1.02) translateZ(0);
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
	}

	.drag-handle {
		touch-action: none;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-8px) translateZ(0);
		}
		to {
			opacity: 1;
			transform: translateY(0) translateZ(0);
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* Containment for better performance */
	.item-card,
	.workout-link,
	.add-panel {
		contain: layout style paint;
	}

	/* Respect user's motion preferences */
	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}

		.workout-link:active {
			transform: none;
		}
	}
</style>
