<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { programs, user } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { setPageNav } from '$lib/nav.svelte';
	import { DAY_FULL, DAY_NAMES } from '$lib/constants';
	import { libraryHref, runProgramHref } from '$lib/routes';
	import { itemsForDay, type ProgramDay, type ProgramItem } from '$lib/types';
	import ActionSheet, { type SheetAction } from '$lib/components/ActionSheet.svelte';
	import AddToPlanSheet from '$lib/components/AddToPlanSheet.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import EditProgramSheet from '$lib/components/EditProgramSheet.svelte';
	import NameSheet from '$lib/components/NameSheet.svelte';
	import SortableList from '$lib/components/SortableList.svelte';
	import RowMenuButton from '../../library/RowMenuButton.svelte';
	import AddIcon from '$lib/icons/add.svg?raw';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import DragIndicatorIcon from '$lib/icons/drag_indicator.svg?raw';
	import CheckIcon from '$lib/icons/check.svg?raw';
	import NotesIcon from '$lib/icons/notes.svg?raw';

	let program = $derived(session.program(page.params.programId));
	let isActive = $derived(session.activeProgramId === program?.id);
	let unit = $derived(session.prefs.weightUnit);

	setPageNav(
		() => program?.name ?? '',
		() => libraryHref('programs')
	);

	const todayDow = new Date().getDay();
	const todayStr = new Date().toDateString();

	let selectedDay = $state(todayDow);
	let schedule = $derived<ProgramDay[]>(program?.schedule ?? []);
	let dayEntry = $derived(schedule.find((d) => d.day === selectedDay) ?? null);
	let dayItems = $derived(program ? itemsForDay(program, selectedDay) : []);

	/** Exercises already on this day, including those inside scheduled routines. */
	let usedWorkoutIds = $derived(
		dayItems.flatMap((item) =>
			item.type === 'exercise'
				? [item.workoutId]
				: (session.routine(item.routineId)?.exercises.map((ex) => ex.workoutId) ?? [])
		)
	);
	let usedRoutineIds = $derived(
		dayItems.filter((i) => i.type === 'routine').map((i) => i.routineId)
	);
	let availableExercises = $derived(
		(session.workouts ?? []).filter((w) => !usedWorkoutIds.includes(w.id))
	);
	let availableRoutines = $derived(
		(session.routines ?? []).filter((r) => !usedRoutineIds.includes(r.id))
	);

	function setsToday(workoutId: string): number {
		return (
			session.workout(workoutId)?.sets.filter((s) => new Date(s.date).toDateString() === todayStr)
				.length ?? 0
		);
	}

	/** Flat exercise count for a day, expanding routines. */
	function exerciseCount(day: number): number {
		if (!program) return 0;
		return itemsForDay(program, day).reduce((sum, item) => {
			if (item.type === 'exercise') return sum + 1;
			return sum + (session.routine(item.routineId)?.exercises.length ?? 0);
		}, 0);
	}

	let totalToday = $derived(exerciseCount(selectedDay));
	let doneToday = $derived.by(() =>
		dayItems.reduce((sum, item) => {
			if (item.type === 'exercise') {
				return sum + (setsToday(item.workoutId) >= item.targetSets ? 1 : 0);
			}
			const routine = session.routine(item.routineId);
			if (!routine) return sum;
			return (
				sum +
				routine.exercises.filter((ex) =>
					ex.targetSets ? setsToday(ex.workoutId) >= ex.targetSets : setsToday(ex.workoutId) > 0
				).length
			);
		}, 0)
	);

	// ── Sheets ──────────────────────────────────────────────────────────────────
	let reordering = $state(false);
	let showProgramMenu = $state(false);
	let showItemMenu = $state(false);
	let showAdd = $state(false);
	let showEditProgram = $state(false);
	let showLabelSheet = $state(false);
	let labelDraft = $state('');
	let deleteProgramDialog = $state<HTMLDialogElement>()!;
	let clearDayDialog = $state<HTMLDialogElement>()!;
	let removeItemDialog = $state<HTMLDialogElement>()!;
	let selectedItemIndex = $state<number | null>(null);

	let selectedItem = $derived(
		selectedItemIndex === null ? null : (dayItems[selectedItemIndex] ?? null)
	);
	let selectedItemName = $derived(
		selectedItem === null
			? ''
			: selectedItem.type === 'routine'
				? (session.routine(selectedItem.routineId)?.name ?? 'Routine')
				: (session.workout(selectedItem.workoutId)?.name ?? 'Exercise')
	);

	let programActions = $derived<SheetAction[]>(
		[
			totalToday > 0
				? {
						label: `Start ${DAY_NAMES[selectedDay]} workout`,
						icon: CheckIcon,
						onSelect: () => goto(runProgramHref(program!.id, selectedDay))
					}
				: null,
			{
				label: isActive ? 'Deactivate program' : 'Set as active program',
				icon: CheckIcon,
				onSelect: () => user.setActiveProgram(isActive ? null : program!.id)
			},
			{
				label: `Add to ${DAY_NAMES[selectedDay]}`,
				icon: AddIcon,
				onSelect: () => (showAdd = true)
			},
			dayItems.length > 1
				? {
						label: reordering ? 'Done reordering' : 'Reorder this day',
						icon: DragIndicatorIcon,
						onSelect: () => (reordering = !reordering)
					}
				: null,
			{
				label: dayEntry?.label ? 'Rename this day' : 'Label this day',
				icon: NotesIcon,
				onSelect: () => {
					labelDraft = dayEntry?.label ?? '';
					showLabelSheet = true;
				}
			},
			dayItems.length
				? {
						label: `Clear ${DAY_NAMES[selectedDay]}`,
						icon: DeleteIcon,
						destructive: true,
						onSelect: () => clearDayDialog?.showModal()
					}
				: null,
			{ label: 'Edit program', icon: EditIcon, onSelect: () => (showEditProgram = true) },
			{
				label: 'Delete program',
				icon: DeleteIcon,
				destructive: true,
				onSelect: () => deleteProgramDialog?.showModal()
			}
		].filter((a) => a !== null)
	);

	let itemActions = $derived<SheetAction[]>(
		[
			selectedItem?.type === 'exercise'
				? {
						label: 'More sets',
						icon: AddIcon,
						onSelect: () => stepTargetSets(selectedItemIndex!, 1)
					}
				: null,
			selectedItem?.type === 'exercise'
				? {
						label: 'Fewer sets',
						icon: EditIcon,
						onSelect: () => stepTargetSets(selectedItemIndex!, -1)
					}
				: null,
			selectedItem?.type === 'routine'
				? {
						label: 'Open routine',
						icon: EditIcon,
						onSelect: () => goto(`/routines/${selectedItem.routineId}`)
					}
				: null,
			{
				label: 'Remove from day',
				icon: DeleteIcon,
				destructive: true,
				onSelect: () => removeItemDialog?.showModal()
			}
		].filter((a) => a !== null)
	);

	// ── Mutations ───────────────────────────────────────────────────────────────

	/** Upserts one day's items, dropping the day entry when it empties out. */
	function withDay(day: number, items: ProgramItem[], label?: string): ProgramDay[] {
		const existing = schedule.find((d) => d.day === day);
		const resolvedLabel = label !== undefined ? label : existing?.label;
		if (items.length === 0 && !resolvedLabel) return schedule.filter((d) => d.day !== day);
		const next: ProgramDay = {
			day,
			items,
			...(resolvedLabel ? { label: resolvedLabel } : {})
		};
		return existing
			? schedule.map((d) => (d.day === day ? next : d))
			: [...schedule, next].sort((a, b) => a.day - b.day);
	}

	function saveDay(items: ProgramItem[], label?: string) {
		if (!program) return;
		return programs.setSchedule(program.id, withDay(selectedDay, items, label));
	}

	function addExercise(workoutId: string) {
		saveDay([...dayItems, { type: 'exercise', workoutId, targetSets: 3 }]);
	}

	function addRoutine(routineId: string) {
		saveDay([...dayItems, { type: 'routine', routineId }]);
	}

	async function createExercise(name: string) {
		if (!program) return;
		// One batch: the exercise document and the schedule entry pointing at it
		// land together, so the day can never reference a missing exercise.
		await programs.createExerciseAndAddToDay(program.id, name, (workoutId) =>
			withDay(selectedDay, [...dayItems, { type: 'exercise', workoutId, targetSets: 3 }])
		);
	}

	function removeItem(index: number) {
		saveDay(dayItems.filter((_, i) => i !== index));
	}

	function stepTargetSets(index: number, delta: number) {
		const item = dayItems[index];
		if (item?.type !== 'exercise') return;
		saveDay(
			dayItems.map((it, i) =>
				i === index && it.type === 'exercise'
					? { ...it, targetSets: Math.max(1, Math.min(99, it.targetSets + delta)) }
					: it
			)
		);
	}

	function openItemMenu(index: number) {
		selectedItemIndex = index;
		showItemMenu = true;
	}
</script>

{#snippet itemBody(item: ProgramItem)}
	{#if item.type === 'routine'}
		{@const routine = session.routine(item.routineId)}
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<div class="flex items-center gap-2">
				<span class="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-xs font-semibold"
					>Routine</span
				>
				<span class="truncate font-semibold">{routine?.name ?? 'Unknown'}</span>
			</div>
			{#if routine?.exercises.length}
				<div class="mt-0.5 flex flex-col gap-0.5">
					{#each routine.exercises as ex (ex.workoutId)}
						{@const done = setsToday(ex.workoutId)}
						<div class="flex items-center gap-2">
							<span class="text-base-content/60 min-w-0 flex-1 truncate text-xs"
								>{session.workout(ex.workoutId)?.name ?? '—'}</span
							>
							{#if ex.targetSets}
								<span
									class={done >= ex.targetSets
										? 'text-success text-xs'
										: 'text-base-content/40 text-xs'}
									>{done >= ex.targetSets ? '✓' : `${done}/${ex.targetSets}`}</span
								>
							{:else}
								<span class="text-base-content/30 text-xs">{done > 0 ? `${done} sets` : '—'}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		{@const done = setsToday(item.workoutId)}
		{@const last = session.workout(item.workoutId)?.sets.at(-1)}
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<span class="truncate text-sm font-semibold"
				>{session.workout(item.workoutId)?.name ?? '—'}</span
			>
			<div class="text-base-content/40 flex items-center gap-1.5 text-xs">
				{#if done >= item.targetSets}
					<span class="text-success font-semibold">✓ Done ({done} sets)</span>
				{:else if done > 0}
					<span>{done}/{item.targetSets} sets today</span>
				{:else if last}
					<span>{last.reps} reps{last.weight ? ` · ${last.weight} ${unit}` : ''}</span>
				{:else}
					<span>{item.targetSets} sets planned</span>
				{/if}
			</div>
		</div>
		<span class="badge badge-ghost badge-sm shrink-0 self-center">{item.targetSets} sets</span>
	{/if}
{/snippet}

{#if session.programs === null}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<div class="skeleton h-12 w-full rounded-2xl"></div>
		<div class="skeleton h-64 w-full rounded-2xl"></div>
	</div>
{:else if program}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<div class="flex items-center justify-between gap-2">
			{#if isActive}
				<span class="badge badge-primary badge-sm">Active Program</span>
			{:else}
				<button class="btn btn-ghost btn-xs" onclick={() => user.setActiveProgram(program.id)}
					>Set as active</button
				>
			{/if}
			<RowMenuButton label="Program options" onclick={() => (showProgramMenu = true)} />
		</div>

		<!-- Day picker -->
		<div class="-mr-2 flex items-center gap-1.5 overflow-x-auto pr-2 pb-0.5">
			{#each [0, 1, 2, 3, 4, 5, 6] as dayNum}
				{@const count = exerciseCount(dayNum)}
				<div class="flex shrink-0 flex-col items-center">
					<button
						class="btn btn-sm"
						class:btn-primary={selectedDay === dayNum}
						class:btn-ghost={selectedDay !== dayNum}
						class:ring-2={dayNum === todayDow && selectedDay !== dayNum}
						class:ring-primary={dayNum === todayDow && selectedDay !== dayNum}
						aria-label="{DAY_FULL[dayNum]} — {count} exercises"
						onclick={() => {
							selectedDay = dayNum;
							reordering = false;
						}}
					>
						{DAY_NAMES[dayNum]}
					</button>
					<span
						class="mt-0.5 h-1.5 w-1.5 rounded-full transition-colors"
						class:bg-primary={count > 0}
						class:bg-transparent={count === 0}
					></span>
				</div>
			{/each}
		</div>

		{#if dayEntry?.label}
			<p class="text-base-content/60 text-sm font-medium">{dayEntry.label}</p>
		{/if}

		<!-- Start CTA -->
		{#if totalToday > 0}
			<div class="flex gap-2">
				{#if selectedDay === todayDow}
					<div class="bg-base-200 flex-1 rounded-xl px-4 py-2.5 text-center">
						<p class="text-base-content/50 text-xs">Today</p>
						<p class="text-sm font-semibold">{doneToday}/{totalToday}</p>
					</div>
				{/if}
				<button
					class="btn btn-primary"
					class:flex-3={selectedDay === todayDow}
					class:w-full={selectedDay !== todayDow}
					onclick={() => goto(runProgramHref(program.id, selectedDay))}
				>
					{#if selectedDay !== todayDow}
						Start {DAY_NAMES[selectedDay]} workout
					{:else if doneToday > 0 && doneToday < totalToday}
						Continue
					{:else if doneToday >= totalToday}
						Do Again
					{:else}
						Start
					{/if}
				</button>
			</div>
		{/if}

		<!-- Items -->
		{#if reordering}
			<div class="bg-primary/10 text-primary rounded-xl px-4 py-2.5 text-sm font-medium">
				Drag the handles to reorder, then tap Done.
			</div>
			<SortableList
				items={dayItems}
				key={(item) => (item.type === 'routine' ? item.routineId : item.workoutId)}
				onReorder={(next) => saveDay(next)}
			>
				{#snippet children(item)}
					<div class="bg-base-200 rounded-box flex items-start gap-3 px-4 py-3">
						{@render itemBody(item)}
					</div>
				{/snippet}
			</SortableList>
			<button class="btn btn-primary w-full" onclick={() => (reordering = false)}>Done</button>
		{:else if dayItems.length}
			<ul class="flex flex-col gap-2 pb-2">
				{#each dayItems as item, i}
					<li class="bg-base-200 rounded-box flex items-start gap-2 px-4 py-3">
						{@render itemBody(item)}
						<RowMenuButton label="Options for this item" onclick={() => openItemMenu(i)} />
					</li>
				{/each}
			</ul>
		{:else}
			<div class="flex flex-col items-center gap-3 py-12 text-center">
				<p class="text-base-content/50 text-sm">Nothing scheduled for {DAY_FULL[selectedDay]}.</p>
				<button class="btn btn-primary btn-sm" onclick={() => (showAdd = true)}>
					{@html AddIcon} Add to {DAY_NAMES[selectedDay]}
				</button>
			</div>
		{/if}
	</div>
{:else}
	<div class="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
		<p class="font-semibold">That program isn't available</p>
		<p class="text-base-content/50 text-sm">It may have been deleted on another device.</p>
		<a class="btn btn-primary btn-sm" href={libraryHref('programs')}>Back to Library</a>
	</div>
{/if}

<ActionSheet bind:open={showProgramMenu} title={program?.name} actions={programActions} />
<ActionSheet bind:open={showItemMenu} title={selectedItemName} actions={itemActions} />

<AddToPlanSheet
	bind:open={showAdd}
	title="Add to {DAY_FULL[selectedDay]}"
	exercises={availableExercises}
	routines={availableRoutines}
	onAddExercise={addExercise}
	onAddRoutine={addRoutine}
	onCreateExercise={createExercise}
/>

<EditProgramSheet
	bind:open={showEditProgram}
	{program}
	onSave={(name, notes) => program && programs.update(program.id, { name, notes })}
/>

<ConfirmationDialog
	bind:dialog={removeItemDialog}
	header="Remove from {DAY_FULL[selectedDay]}?"
	content="This only changes the schedule. Nothing else is deleted."
	actionLabel="Remove"
	destructive
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default' && selectedItemIndex !== null) {
			removeItem(selectedItemIndex);
		}
		selectedItemIndex = null;
	}}
/>

<ConfirmationDialog
	bind:dialog={clearDayDialog}
	header="Clear {DAY_FULL[selectedDay]}?"
	content="Removes everything scheduled for this day."
	actionLabel="Clear day"
	destructive
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default') saveDay([]);
	}}
/>

<ConfirmationDialog
	bind:dialog={deleteProgramDialog}
	header="Delete “{program?.name ?? ''}”?"
	content="Your routines and exercises won't be affected."
	actionLabel="Delete"
	destructive
	onclose={async (e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default' && program) {
			await programs.remove(program.id);
			goto(libraryHref('programs'));
		}
	}}
/>

<NameSheet
	bind:open={showLabelSheet}
	title="Label {DAY_FULL[selectedDay]}"
	placeholder="e.g. Upper Hypertrophy"
	submitLabel="Save"
	initialValue={labelDraft}
	onSave={(label) => saveDay(dayItems, label)}
/>
