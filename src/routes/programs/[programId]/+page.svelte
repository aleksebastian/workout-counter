<script lang="ts">
	import { user, userData, db } from '$lib/firebase';
	import {
		type Program,
		type ProgramItem,
		type ProgramDay,
		getProgramSchedule,
		getProgramItemsForDay,
		getRoutineExercises
	} from '$lib/state.svelte';
	import { v4 as uuidv4 } from 'uuid';
	import { doc, updateDoc } from 'firebase/firestore';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import BackButton from '$lib/components/Buttons/BackButton.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import AddIcon from '$lib/icons/add.svg?raw';
	import RemoveIcon from '$lib/icons/remove.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import UpIcon from '$lib/icons/up.svg?raw';
	import DownIcon from '$lib/icons/down.svg?raw';

	const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	let session = $derived($userData?.programs?.find((s) => s.id === page.params.programId));
	let isActive = $derived($userData?.activeProgramId === session?.id);

	let schedule = $derived(session ? getProgramSchedule(session) : ([] as ProgramDay[]));
	let scheduledDays = $derived(schedule.map((sd) => sd.day));
	let unscheduledDays = $derived([0, 1, 2, 3, 4, 5, 6].filter((d) => !scheduledDays.includes(d)));

	// Selected day — init to today if scheduled, else first scheduled day
	let selectedDay = $state<number | undefined>(undefined);
	$effect(() => {
		if (selectedDay !== undefined) return;
		if (!schedule.length) return;
		const today = new Date().getDay();
		const todayEntry = schedule.find((sd) => sd.day === today);
		selectedDay = todayEntry?.day ?? schedule[0].day;
	});

	let todayDow = $derived(new Date().getDay());
	let todayStr = $derived(new Date().toDateString());

	// Items for the currently selected day
	let dayItems = $derived<ProgramItem[]>(
		session && selectedDay !== undefined ? getProgramItemsForDay(session, selectedDay) : []
	);

	// Derived exclusions for add panel (scoped to selected day only)
	let dayWorkoutIds = $derived(
		dayItems.flatMap((item) => {
			if (item.type === 'exercise') return [item.workoutId];
			const routine = $userData?.routines?.find((r) => r.id === item.routineId);
			return routine ? getRoutineExercises(routine).map((ex) => ex.workoutId) : [];
		})
	);
	let dayRoutineIds = $derived(
		dayItems
			.filter((i): i is { type: 'routine'; routineId: string } => i.type === 'routine')
			.map((i) => i.routineId)
	);
	let workoutsNotInDay = $derived(
		($userData?.workouts ?? []).filter((w) => !dayWorkoutIds.includes(w.id))
	);
	let routinesNotInDay = $derived(
		($userData?.routines ?? []).filter((r) => !dayRoutineIds.includes(r.id))
	);

	let isEditing = $state(false);
	let addPanelSection = $state<'none' | 'routines' | 'exercises'>('none');
	let addDayOpen = $state(false);
	let pendingDays = $state<number[]>([]);
	let showNewExerciseInput = $state(false);
	let newExerciseName = $state('');
	let newExerciseError = $state('');
	let searchQuery = $state('');
	let editingDayLabel = $state(false);
	let dayLabelDraft = $state('');
	let weightUnit = $derived($userData?.preferences?.weightUnit ?? 'lbs');
	let deleteDayDialog = $state() as HTMLDialogElement;
	let dayToDelete = $state<number | undefined>(undefined);

	function filteredWorkouts() {
		return searchQuery.trim()
			? workoutsNotInDay.filter((w) => w.name.toLowerCase().includes(searchQuery.toLowerCase()))
			: workoutsNotInDay;
	}

	function getSetsToday(workoutId: string): number {
		return (
			$userData?.workouts
				.find((w) => w.id === workoutId)
				?.sets.filter((s) => new Date(s.date).toDateString() === todayStr).length ?? 0
		);
	}
	function getLastSet(workoutId: string) {
		const w = $userData?.workouts.find((w) => w.id === workoutId);
		if (!w?.sets.length) return null;
		return w.sets.at(-1)!;
	}

	// ── Persistence ─────────────────────────────────────────────────────────────

	async function updateSession(updated: Program) {
		if (!$userData) return;
		const programs = ($userData.programs ?? []).map((s) => (s.id === updated.id ? updated : s));
		const userRef = doc(db, 'users', $user!.uid);
		await updateDoc(userRef, { programs });
	}

	async function saveDayItems(items: ProgramItem[]) {
		if (!session || selectedDay === undefined) return;
		const newSchedule = schedule.map((sd) => (sd.day === selectedDay ? { ...sd, items } : sd));
		try {
			await updateSession({ ...session, schedule: newSchedule });
		} catch (e) {
			console.error(e);
		}
	}

	// ── Day management ───────────────────────────────────────────────────────────

	function togglePendingDay(day: number) {
		if (pendingDays.includes(day)) {
			pendingDays = pendingDays.filter((d) => d !== day);
		} else {
			pendingDays = [...pendingDays, day];
		}
	}

	async function handleAddDays() {
		if (!session || pendingDays.length === 0) return;
		const newDayEntries = pendingDays.map((day) => ({ day, items: [] }));
		const newSchedule = [...schedule, ...newDayEntries].sort((a, b) => a.day - b.day);
		try {
			await updateSession({ ...session, schedule: newSchedule });
			selectedDay = pendingDays[0];
			addDayOpen = false;
			pendingDays = [];
		} catch (e) {
			console.error(e);
		}
	}

	function handleCancelAddDays() {
		addDayOpen = false;
		pendingDays = [];
	}

	function handleRemoveDay(day: number) {
		dayToDelete = day;
		deleteDayDialog?.showModal();
	}

	async function confirmRemoveDay() {
		if (!session || dayToDelete === undefined) return;
		const newSchedule = schedule.filter((sd) => sd.day !== dayToDelete);
		try {
			await updateSession({ ...session, schedule: newSchedule });
			if (selectedDay === dayToDelete) {
				const today = new Date().getDay();
				selectedDay = newSchedule.find((sd) => sd.day === today)?.day ?? newSchedule[0]?.day;
			}
			dayToDelete = undefined;
		} catch (e) {
			console.error(e);
		}
	}

	async function handleSaveDayLabel() {
		if (!session || selectedDay === undefined) return;
		const newSchedule = schedule.map((sd) =>
			sd.day === selectedDay ? { ...sd, label: dayLabelDraft.trim() || undefined } : sd
		);
		try {
			await updateSession({ ...session, schedule: newSchedule });
			editingDayLabel = false;
		} catch (e) {
			console.error(e);
		}
	}

	// ── Item management (per day) ────────────────────────────────────────────────

	async function handleAddRoutine(routineId: string) {
		await saveDayItems([...dayItems, { type: 'routine', routineId }]);
	}
	async function handleAddWorkout(workoutId: string) {
		await saveDayItems([...dayItems, { type: 'exercise', workoutId, targetSets: 3 }]);
		searchQuery = '';
	}
	async function handleRemoveItem(i: number) {
		const items = [...dayItems];
		items.splice(i, 1);
		await saveDayItems(items);
	}
	async function handleMoveUp(i: number) {
		if (i === 0) return;
		const items = [...dayItems];
		[items[i - 1], items[i]] = [items[i], items[i - 1]];
		await saveDayItems(items);
	}
	async function handleMoveDown(i: number) {
		if (i >= dayItems.length - 1) return;
		const items = [...dayItems];
		[items[i], items[i + 1]] = [items[i + 1], items[i]];
		await saveDayItems(items);
	}
	async function handleUpdateTargetSets(i: number, delta: number) {
		const item = dayItems[i];
		if (item.type !== 'exercise') return;
		const items = dayItems.map((it, idx) =>
			idx === i
				? { ...it, targetSets: Math.max(1, Math.min(99, (it as typeof item).targetSets + delta)) }
				: it
		);
		await saveDayItems(items);
	}
	async function handleCreateAndAddExercise() {
		if (!$userData || !session || selectedDay === undefined) return;
		const name = newExerciseName.trim();
		if (!name) {
			newExerciseError = 'Name required';
			return;
		}
		if ($userData.workouts.some((w) => w.name.toLowerCase() === name.toLowerCase())) {
			newExerciseError = 'Exercise already exists';
			return;
		}
		const newWorkout = { id: uuidv4(), name, sets: [] };
		const workouts = [...$userData.workouts, newWorkout];
		const newItems: ProgramItem[] = [
			...dayItems,
			{ type: 'exercise', workoutId: newWorkout.id, targetSets: 3 }
		];
		const newSchedule = schedule.map((sd) =>
			sd.day === selectedDay ? { ...sd, items: newItems } : sd
		);
		const programs = ($userData.programs ?? []).map((s) =>
			s.id === session!.id ? { ...session!, schedule: newSchedule } : s
		);
		const userRef = doc(db, 'users', $user!.uid);
		try {
			await updateDoc(userRef, { workouts, programs });
			newExerciseName = '';
			newExerciseError = '';
			showNewExerciseInput = false;
		} catch (e) {
			console.error(e);
		}
	}

	// ── Active session ───────────────────────────────────────────────────────────
	async function handleSetActive() {
		if (!session) return;
		const userRef = doc(db, 'users', $user!.uid);
		await updateDoc(userRef, { activeProgramId: isActive ? null : session.id });
	}

	// ── Stats for selected day ───────────────────────────────────────────────────
	let totalFlatItems = $derived.by(() =>
		dayItems.reduce((sum, item) => {
			if (item.type === 'exercise') return sum + 1;
			const routine = $userData?.routines?.find((r) => r.id === item.routineId);
			return sum + (routine ? getRoutineExercises(routine).length : 0);
		}, 0)
	);
	let doneToday = $derived.by(() =>
		dayItems.reduce((sum, item) => {
			if (item.type === 'exercise')
				return sum + (getSetsToday(item.workoutId) >= item.targetSets ? 1 : 0);
			const routine = $userData?.routines?.find((r) => r.id === item.routineId);
			if (!routine) return sum;
			return (
				sum +
				getRoutineExercises(routine).filter((ex) =>
					ex.targetSets
						? getSetsToday(ex.workoutId) >= ex.targetSets
						: getSetsToday(ex.workoutId) > 0
				).length
			);
		}, 0)
	);
</script>

{#if session}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<!-- ── Header ──────────────────────────────────────────────────────────── -->
		<div class="flex items-center justify-between">
			<BackButton href="/programs" />
			<div class="flex flex-col items-center gap-0.5 text-center">
				<h1 class="text-xl leading-tight font-bold">{session.name}</h1>
				{#if isActive}
					<span class="badge badge-primary badge-xs">Active Program</span>
				{/if}
			</div>
			<button
				class="btn btn-ghost btn-sm w-14 font-semibold"
				class:text-primary={isEditing}
				onclick={() => {
					isEditing = !isEditing;
					addPanelSection = 'none';
					addDayOpen = false;
					showNewExerciseInput = false;
					editingDayLabel = false;
					searchQuery = '';
				}}>{isEditing ? 'Done' : 'Edit'}</button
			>
		</div>

		<!-- ── Active toggle (view mode only) ─────────────────────────────────── -->
		{#if !isEditing}
			<button
				class="btn btn-sm w-full"
				class:btn-outline={!isActive}
				class:btn-primary={!isActive}
				class:btn-ghost={isActive}
				onclick={handleSetActive}
			>
				{isActive ? '● Active Program — tap to deactivate' : 'Set as Active Program'}
			</button>
		{/if}

		<!-- ── Day pills ───────────────────────────────────────────────────────── -->
		{#if schedule.length > 0 || isEditing}
			<div class="-mt-2 -mr-2 flex items-center gap-1.5 overflow-x-auto pt-2 pr-2 pb-0.5">
				{#each schedule as sd}
					<div class="relative shrink-0">
						<button
							class="btn btn-sm relative"
							class:btn-primary={selectedDay === sd.day}
							class:btn-ghost={selectedDay !== sd.day}
							onclick={() => {
								selectedDay = sd.day;
								addPanelSection = 'none';
								editingDayLabel = false;
							}}
						>
							{DAY_NAMES[sd.day]}
							{#if sd.day === todayDow}
								<span
									class={[
										'ring-base-100 absolute -top-1 -right-1 h-2 w-2 rounded-full ring-1',
										selectedDay === sd.day ? 'bg-base-content/30 opacity-0' : 'bg-primary'
									].join(' ')}
								></span>
							{/if}
						</button>
						{#if isEditing}
							<button
								class="bg-error text-error-content absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold shadow"
								onclick={() => handleRemoveDay(sd.day)}
								aria-label="Remove {DAY_NAMES[sd.day]}">✕</button
							>
						{/if}
					</div>
				{/each}

				{#if isEditing && unscheduledDays.length > 0}
					<button
						class="btn btn-ghost btn-sm text-primary shrink-0"
						onclick={() => {
							addDayOpen = !addDayOpen;
							if (addDayOpen) pendingDays = [];
						}}>+ Day</button
					>
				{/if}
			</div>

			<!-- Add day picker -->
			{#if isEditing && addDayOpen && unscheduledDays.length > 0}
				<div class="bg-base-200 rounded-box flex flex-col gap-3 px-4 py-3">
					<p class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">
						Add day
					</p>
					<div class="flex flex-wrap gap-2">
						{#each unscheduledDays as d}
							<button
								class="btn btn-sm"
								class:btn-primary={pendingDays.includes(d)}
								class:btn-outline={!pendingDays.includes(d)}
								onclick={() => togglePendingDay(d)}>{DAY_FULL[d]}</button
							>
						{/each}
					</div>
					<div class="flex gap-2">
						<button
							class="btn btn-primary btn-sm flex-1"
							disabled={pendingDays.length === 0}
							onclick={handleAddDays}>Done</button
						>
						<button class="btn btn-ghost btn-sm" onclick={handleCancelAddDays}>Cancel</button>
					</div>
				</div>
			{/if}
		{/if}

		{#if selectedDay !== undefined && schedule.length > 0}
			{@const selectedEntry = schedule.find((sd) => sd.day === selectedDay)}

			<!-- ── Day label ────────────────────────────────────────────────────── -->
			{#if isEditing}
				{#if editingDayLabel}
					<div class="flex gap-2">
						<input
							type="text"
							class="input input-bordered input-sm flex-1"
							placeholder="Day label, e.g. Upper Hypertrophy"
							bind:value={dayLabelDraft}
							onkeydown={(e) => {
								if (e.key === 'Enter') handleSaveDayLabel();
								if (e.key === 'Escape') {
									editingDayLabel = false;
								}
							}}
						/>
						<button class="btn btn-primary btn-sm" onclick={handleSaveDayLabel}>Save</button>
						<button class="btn btn-ghost btn-sm" onclick={() => (editingDayLabel = false)}
							>Cancel</button
						>
					</div>
				{:else}
					<button
						class="text-base-content/40 hover:text-primary flex items-center gap-1.5 text-xs"
						onclick={() => {
							dayLabelDraft = selectedEntry?.label ?? '';
							editingDayLabel = true;
						}}
					>
						<span class="[&>svg]:h-3 [&>svg]:w-3">{@html AddIcon}</span>
						{selectedEntry?.label
							? `"${selectedEntry.label}" — tap to edit`
							: 'Add day label (e.g. Upper Hypertrophy)'}
					</button>
				{/if}
			{:else if selectedEntry?.label}
				<p class="text-base-content/60 text-sm font-medium">{selectedEntry.label}</p>
			{/if}

			<!-- ── Start CTA (view mode, today's day with items) ────────────────── -->
			{#if !isEditing && selectedDay === todayDow && totalFlatItems > 0}
				<div class="flex gap-2">
					<div class="bg-base-200 flex-1 rounded-xl px-4 py-2.5 text-center">
						<p class="text-base-content/50 text-xs">Today</p>
						<p class="text-sm font-semibold">{doneToday}/{totalFlatItems}</p>
					</div>
					<button
						class="btn btn-primary flex-3"
						onclick={() => goto(`/programs/${session!.id}/run?day=${selectedDay}`)}
					>
						{doneToday > 0 && doneToday < totalFlatItems
							? 'Continue'
							: doneToday >= totalFlatItems
								? 'Do Again'
								: 'Start'}
					</button>
				</div>
			{:else if !isEditing && selectedDay !== todayDow && totalFlatItems > 0}
				<button
					class="btn btn-outline btn-primary w-full"
					onclick={() => goto(`/programs/${session!.id}/run?day=${selectedDay}`)}
					>Start {DAY_NAMES[selectedDay ?? 0]} workout</button
				>
			{/if}

			<!-- ── Items list ────────────────────────────────────────────────────── -->
			{#if dayItems.length > 0}
				<ul class="flex flex-col gap-2 pb-2">
					{#each dayItems as item, i}
						{@const isRoutineItem = item.type === 'routine'}
						{@const routine = isRoutineItem
							? ($userData?.routines?.find((r) => r.id === item.routineId) ?? null)
							: null}
						{@const routineExercises = routine ? getRoutineExercises(routine) : []}

						<li class="bg-base-200 rounded-box flex items-start gap-3 px-4 py-3">
							{#if isEditing}
								<div class="flex flex-col gap-0.5 pt-0.5">
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => handleMoveUp(i)}
										disabled={i === 0}
										aria-label="Move up">{@html UpIcon}</button
									>
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => handleMoveDown(i)}
										disabled={i === dayItems.length - 1}
										aria-label="Move down">{@html DownIcon}</button
									>
								</div>
							{/if}

							<div class="flex flex-1 flex-col gap-1 overflow-hidden">
								{#if isRoutineItem}
									<div class="flex items-center gap-2">
										<span
											class="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-xs font-semibold"
											>Routine</span
										>
										<span class="truncate font-semibold">{routine?.name ?? 'Unknown'}</span>
									</div>
									{#if routineExercises.length > 0}
										<div class="mt-1 flex flex-col gap-0.5">
											{#each routineExercises as ex}
												{@const workout = $userData?.workouts.find((w) => w.id === ex.workoutId)}
												{@const sets = getSetsToday(ex.workoutId)}
												<div class="flex items-center gap-2">
													<span class="text-base-content/60 min-w-0 flex-1 truncate text-xs"
														>{workout?.name ?? '—'}</span
													>
													{#if !isEditing}
														{#if ex.targetSets}
															<span
																class={sets >= ex.targetSets
																	? 'text-success text-xs'
																	: 'text-base-content/40 text-xs'}
																>{sets >= ex.targetSets ? '✓' : `${sets}/${ex.targetSets}`}</span
															>
														{:else}
															<span class="text-base-content/30 text-xs"
																>{sets > 0 ? `${sets} sets` : '—'}</span
															>
														{/if}
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								{:else}
									{@const workout = $userData?.workouts.find((w) => w.id === item.workoutId)}
									{@const sets = getSetsToday(item.workoutId)}
									{@const lastSet = getLastSet(item.workoutId)}
									<span class="truncate text-sm font-semibold">{workout?.name ?? '—'}</span>
									{#if isEditing}
										<div class="mt-1 flex items-center gap-2">
											<button
												class="btn btn-circle btn-xs btn-ghost"
												onclick={() => handleUpdateTargetSets(i, -1)}
												aria-label="Fewer sets">{@html RemoveIcon}</button
											>
											<span class="text-sm font-semibold tabular-nums">{item.targetSets}</span>
											<button
												class="btn btn-circle btn-xs btn-ghost"
												onclick={() => handleUpdateTargetSets(i, 1)}
												aria-label="More sets">{@html AddIcon}</button
											>
											<span class="text-base-content/40 text-xs">target sets</span>
										</div>
									{:else}
										<div class="text-base-content/40 flex items-center gap-1.5 text-xs">
											{#if sets >= item.targetSets}
												<span class="text-success font-semibold">✓ Done ({sets} sets)</span>
											{:else if sets > 0}
												<span>{sets}/{item.targetSets} sets today</span>
											{:else if lastSet}
												<span
													>{lastSet.reps} reps{lastSet.weight
														? ` · ${lastSet.weight} ${weightUnit}`
														: ''}</span
												>
											{:else}
												<span>Not done yet</span>
											{/if}
										</div>
									{/if}
								{/if}
							</div>

							{#if isEditing}
								<button
									class="btn btn-ghost btn-sm text-error self-start"
									onclick={() => handleRemoveItem(i)}
									aria-label="Remove">{@html DeleteIcon}</button
								>
							{:else if !isRoutineItem}
								<span class="badge badge-ghost badge-sm shrink-0 self-center"
									>{item.targetSets} sets</span
								>
							{/if}
						</li>
					{/each}
				</ul>
			{:else if !isEditing}
				<div class="flex flex-col items-center gap-3 py-12 text-center">
					<p class="text-base-content/50 text-sm">
						Nothing scheduled for {DAY_NAMES[selectedDay]}.
					</p>
					<button class="btn btn-primary btn-sm" onclick={() => (isEditing = true)}
						>Add exercises</button
					>
				</div>
			{/if}

			<!-- ── Add panel (edit mode) ─────────────────────────────────────────── -->
			{#if isEditing}
				<div class="bg-base-200 rounded-box flex flex-col gap-3 p-4">
					<p class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">
						Add to {DAY_NAMES[selectedDay]}
					</p>
					<div class="flex gap-2">
						<button
							class="btn btn-sm flex-1"
							class:btn-primary={addPanelSection === 'routines'}
							class:btn-ghost={addPanelSection !== 'routines'}
							onclick={() => {
								addPanelSection = addPanelSection === 'routines' ? 'none' : 'routines';
								showNewExerciseInput = false;
							}}>Routines</button
						>
						<button
							class="btn btn-sm flex-1"
							class:btn-primary={addPanelSection === 'exercises'}
							class:btn-ghost={addPanelSection !== 'exercises'}
							onclick={() => {
								addPanelSection = addPanelSection === 'exercises' ? 'none' : 'exercises';
							}}>Exercises</button
						>
					</div>

					{#if addPanelSection === 'routines'}
						{#if routinesNotInDay.length > 0}
							<div class="flex flex-col gap-1.5">
								{#each routinesNotInDay as r}
									{@const ct = getRoutineExercises(r).length}
									<button
										class="bg-base-100 hover:bg-base-300 flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors"
										onclick={() => handleAddRoutine(r.id)}
									>
										<span class="font-medium">{r.name}</span>
										<span class="text-base-content/40 text-xs"
											>{ct} exercise{ct !== 1 ? 's' : ''}</span
										>
									</button>
								{/each}
							</div>
						{:else}
							<p class="text-base-content/40 text-sm">All routines already added for this day.</p>
						{/if}
					{/if}

					{#if addPanelSection === 'exercises'}
						{#if workoutsNotInDay.length > 0}
							<input
								type="search"
								placeholder="Search exercises…"
								class="input input-bordered input-sm w-full"
								bind:value={searchQuery}
							/>
							<div class="flex flex-wrap gap-2">
								{#each filteredWorkouts() as w}
									<button class="btn btn-ghost btn-sm" onclick={() => handleAddWorkout(w.id)}
										>+ {w.name}</button
									>
								{/each}
								{#if filteredWorkouts().length === 0 && searchQuery}
									<p class="text-base-content/40 text-xs">No matches</p>
								{/if}
							</div>
						{/if}
						{#if showNewExerciseInput}
							<div class="flex flex-col gap-1.5">
								<div class="flex gap-2">
									<input
										type="text"
										class="input input-bordered input-sm flex-1"
										placeholder="New exercise name"
										bind:value={newExerciseName}
										onkeydown={(e) => {
											if (e.key === 'Enter') handleCreateAndAddExercise();
											if (e.key === 'Escape') {
												showNewExerciseInput = false;
												newExerciseName = '';
												newExerciseError = '';
											}
										}}
									/>
									<button class="btn btn-primary btn-sm" onclick={handleCreateAndAddExercise}
										>Add</button
									>
									<button
										class="btn btn-ghost btn-sm"
										onclick={() => {
											showNewExerciseInput = false;
											newExerciseName = '';
											newExerciseError = '';
										}}>Cancel</button
									>
								</div>
								{#if newExerciseError}<p class="text-error text-xs">{newExerciseError}</p>{/if}
							</div>
						{:else}
							<button
								class="btn btn-outline btn-primary btn-sm w-full"
								onclick={() => {
									showNewExerciseInput = true;
									newExerciseName = '';
									newExerciseError = '';
								}}>+ New exercise</button
							>
						{/if}
					{/if}
				</div>
			{/if}
		{:else if !isEditing}
			<!-- Empty schedule -->
			<div class="flex flex-col items-center gap-3 py-12 text-center">
				<p class="text-base-content/50 text-sm">No days scheduled yet.</p>
				<button class="btn btn-primary btn-sm" onclick={() => (isEditing = true)}
					>Build schedule</button
				>
			</div>
		{/if}
	</div>
{:else}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<div class="flex items-center justify-between">
			<div class="skeleton h-10 w-10 rounded-full"></div>
			<div class="skeleton h-7 w-40 rounded-lg"></div>
			<div class="skeleton h-9 w-14 rounded-xl"></div>
		</div>
		<div class="skeleton h-12 w-full rounded-2xl"></div>
		<div class="skeleton h-64 w-full rounded-2xl"></div>
	</div>
{/if}

<!-- Delete day confirmation -->
<ConfirmationDialog
	bind:dialog={deleteDayDialog}
	header="Delete {dayToDelete !== undefined ? DAY_FULL[dayToDelete] : 'day'}?"
	content="This will remove the day and all its exercises from your program schedule."
	actionLabel="Delete"
	destructive={true}
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'confirm') {
			confirmRemoveDay();
		}
	}}
/>
