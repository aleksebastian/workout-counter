<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import { routines } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { setPageNav } from '$lib/nav.svelte';
	import { libraryHref, runRoutineHref } from '$lib/routes';
	import ActionSheet, { type SheetAction } from '$lib/components/ActionSheet.svelte';
	import AddToPlanSheet from '$lib/components/AddToPlanSheet.svelte';
	import Chevron from '$lib/components/Chevron.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import EditRoutineSheet from '$lib/components/EditRoutineSheet.svelte';
	import SortableList from '$lib/components/SortableList.svelte';
	import TargetsSheet from '$lib/components/TargetsSheet.svelte';
	import RowMenuButton from '../../library/RowMenuButton.svelte';
	import AddIcon from '$lib/icons/add.svg?raw';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import DragIndicatorIcon from '$lib/icons/drag_indicator.svg?raw';
	import CheckIcon from '$lib/icons/check.svg?raw';
	import type { RoutineExercise, Workout } from '$lib/types';

	let routine = $derived(session.routine(page.params.routineId));
	let unit = $derived(session.prefs.weightUnit);

	setPageNav(
		() => routine?.name ?? '',
		() => libraryHref('routines')
	);

	type Row = { ex: RoutineExercise; workout: Workout };

	/** Routine entries paired with their exercise doc; drops dangling references. */
	let rows = $derived<Row[]>(
		(routine?.exercises ?? [])
			.map((ex) => ({ ex, workout: session.workout(ex.workoutId) }))
			.filter((row): row is Row => row.workout !== null)
	);

	let available = $derived(
		(session.workouts ?? []).filter(
			(w) => !(routine?.exercises ?? []).some((ex) => ex.workoutId === w.id)
		)
	);

	const todayStr = new Date().toDateString();
	let doneToday = $derived(
		rows.filter(({ workout }) =>
			workout.sets.some((s) => new Date(s.date).toDateString() === todayStr)
		).length
	);
	let totalSets = $derived(rows.reduce((sum, { workout }) => sum + workout.sets.length, 0));
	let lastSession = $derived.by(() => {
		const times = rows.flatMap(({ workout }) =>
			workout.sets.map((s) => new Date(s.date).getTime())
		);
		return times.length ? new Date(Math.max(...times)) : null;
	});

	function lastSet(workout: Workout) {
		if (!workout.sets.length) return undefined;
		return workout.sets.reduce((latest, s) =>
			new Date(s.date) > new Date(latest.date) ? s : latest
		);
	}

	// ── Sheets ──────────────────────────────────────────────────────────────────
	let reordering = $state(false);
	let showRoutineMenu = $state(false);
	let showRowMenu = $state(false);
	let showAdd = $state(false);
	let showEditRoutine = $state(false);
	let showTargets = $state(false);
	let deleteRoutineDialog = $state<HTMLDialogElement>()!;
	let removeExerciseDialog = $state<HTMLDialogElement>()!;
	let selectedRow = $state<Row | undefined>(undefined);

	let routineActions = $derived<SheetAction[]>(
		[
			rows.length
				? {
						label: 'Start routine',
						icon: CheckIcon,
						onSelect: () => goto(runRoutineHref(routine!.id))
					}
				: null,
			{ label: 'Add exercises', icon: AddIcon, onSelect: () => (showAdd = true) },
			rows.length > 1
				? {
						label: reordering ? 'Done reordering' : 'Reorder exercises',
						icon: DragIndicatorIcon,
						onSelect: () => (reordering = !reordering)
					}
				: null,
			{ label: 'Edit routine', icon: EditIcon, onSelect: () => (showEditRoutine = true) },
			{
				label: 'Delete routine',
				icon: DeleteIcon,
				destructive: true,
				onSelect: () => deleteRoutineDialog?.showModal()
			}
		].filter((a) => a !== null)
	);

	let rowActions = $derived<SheetAction[]>([
		{
			label: 'Open exercise',
			icon: EditIcon,
			onSelect: () => goto(`/workout/${selectedRow!.workout.id}?from=/routines/${routine!.id}`)
		},
		{ label: 'Set targets', icon: CheckIcon, onSelect: () => (showTargets = true) },
		{
			label: 'Remove from routine',
			icon: DeleteIcon,
			destructive: true,
			onSelect: () => removeExerciseDialog?.showModal()
		}
	]);

	// ── Mutations ───────────────────────────────────────────────────────────────
	function save(exercises: RoutineExercise[]) {
		if (!routine) return;
		return routines.setExercises(routine.id, exercises);
	}

	function addExercise(workoutId: string) {
		save([...(routine?.exercises ?? []), { workoutId }]);
	}

	async function createExercise(name: string) {
		if (!routine) return;
		await routines.createExerciseAndAdd(routine.id, name, routine.exercises);
	}

	function removeExercise(workoutId: string) {
		save((routine?.exercises ?? []).filter((ex) => ex.workoutId !== workoutId));
	}

	function saveTargets(targets: Partial<RoutineExercise>) {
		const id = selectedRow?.workout.id;
		if (!id) return;
		save(
			(routine?.exercises ?? []).map((ex) =>
				ex.workoutId === id ? { workoutId: ex.workoutId, ...targets } : ex
			)
		);
	}

	function openRowMenu(row: Row) {
		selectedRow = row;
		showRowMenu = true;
	}
</script>

{#snippet rowBody(row: Row, index: number)}
	{@const last = lastSet(row.workout)}
	{@const doneNow = row.workout.sets.some((s) => new Date(s.date).toDateString() === todayStr)}
	<div class="flex min-w-0 flex-1 items-center gap-3">
		<span class="text-base-content/40 w-5 shrink-0 text-right text-xs font-medium">{index + 1}</span
		>
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<div class="flex items-center gap-2">
				<span class="truncate text-sm font-semibold">{row.workout.name}</span>
				{#if doneNow}
					<span class="badge badge-success badge-xs shrink-0">Today</span>
				{/if}
			</div>
			{#if row.ex.targetSets || row.ex.minReps || row.ex.maxReps}
				<div class="flex flex-wrap items-center gap-1.5">
					{#if row.ex.targetSets}
						<span class="badge badge-sm badge-outline font-medium"
							>{row.ex.targetSets} set{row.ex.targetSets > 1 ? 's' : ''}</span
						>
					{/if}
					{#if row.ex.minReps || row.ex.maxReps}
						<span class="badge badge-sm badge-outline font-medium">
							{row.ex.minReps ?? '?'}–{row.ex.maxReps ?? '?'} reps
						</span>
					{/if}
				</div>
			{/if}
			{#if last}
				<div class="flex flex-wrap items-center gap-1.5">
					<span class="text-base-content/50 text-xs"
						>{formatDistanceToNow(new Date(last.date), { addSuffix: true })}</span
					>
					<span class="badge badge-sm badge-ghost font-medium">{last.reps} reps</span>
					{#if last.weight && last.weight > 0}
						<span class="badge badge-sm badge-ghost font-medium">{last.weight} {unit}</span>
					{/if}
				</div>
			{:else}
				<span class="text-base-content/35 text-xs">Not done yet</span>
			{/if}
		</div>
	</div>
{/snippet}

{#if session.routines === null}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<div class="skeleton h-10 w-full rounded-xl"></div>
		<div class="skeleton h-14 w-full rounded-2xl"></div>
		{#each { length: 3 } as _}
			<div class="skeleton h-20 w-full rounded-2xl"></div>
		{/each}
	</div>
{:else if routine}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<div class="flex items-center justify-between gap-2">
			<p class="text-base-content/50 text-xs">
				{rows.length} exercise{rows.length !== 1 ? 's' : ''}
			</p>
			<div class="flex items-center gap-1">
				{#if rows.length}
					<button class="btn btn-primary btn-sm" onclick={() => goto(runRoutineHref(routine.id))}
						>Start</button
					>
				{/if}
				<RowMenuButton label="Routine options" onclick={() => (showRoutineMenu = true)} />
			</div>
		</div>

		{#if !reordering && rows.length > 0}
			<div class="-mx-1 flex scrollbar-none gap-2 overflow-x-auto px-1 pb-1">
				<div class="bg-base-200 flex-none rounded-xl px-4 py-2.5 text-center">
					<p class="text-base-content/50 text-xs">Today</p>
					<p class="text-sm font-semibold">{doneToday}/{rows.length}</p>
				</div>
				{#if lastSession}
					<div class="bg-base-200 flex-none rounded-xl px-4 py-2.5 text-center">
						<p class="text-base-content/50 text-xs">Last session</p>
						<p class="text-sm font-semibold">
							{formatDistanceToNow(lastSession, { addSuffix: true })}
						</p>
					</div>
				{/if}
				{#if totalSets > 0}
					<div class="bg-base-200 flex-none rounded-xl px-4 py-2.5 text-center">
						<p class="text-base-content/50 text-xs">Total sets</p>
						<p class="text-sm font-semibold">{totalSets}</p>
					</div>
				{/if}
				{#if routine.timer}
					<div class="bg-base-200 flex-none rounded-xl px-4 py-2.5 text-center">
						<p class="text-base-content/50 text-xs">Rest timer</p>
						<p class="text-primary text-sm font-semibold tabular-nums">
							{routine.timer.minutes}:{routine.timer.seconds < 10 ? '0' : ''}{routine.timer.seconds}
						</p>
					</div>
				{/if}
			</div>
		{/if}

		{#if routine.notes && !reordering}
			<p class="text-base-content/50 text-sm">{routine.notes}</p>
		{/if}

		{#if reordering}
			<div class="bg-primary/10 text-primary rounded-xl px-4 py-2.5 text-sm font-medium">
				Drag the handles to reorder, then tap Done.
			</div>
			<SortableList
				items={rows}
				key={(row) => row.workout.id}
				onReorder={(next) => save(next.map((row) => row.ex))}
			>
				{#snippet children(row, i)}
					<div class="bg-base-200 rounded-2xl px-4 py-3.5">
						{@render rowBody(row, i)}
					</div>
				{/snippet}
			</SortableList>
			<button class="btn btn-primary w-full" onclick={() => (reordering = false)}>Done</button>
		{:else if rows.length}
			<div class="flex flex-col gap-2">
				{#each rows as row, i (row.workout.id)}
					<div class="bg-base-200 flex items-center gap-1 rounded-2xl pr-1.5">
						<a
							class="hover:bg-base-300 flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3.5 transition-colors active:scale-[0.99]"
							href={`/workout/${row.workout.id}?from=/routines/${routine.id}`}
						>
							{@render rowBody(row, i)}
							<Chevron />
						</a>
						<RowMenuButton
							label="Options for {row.workout.name}"
							onclick={() => openRowMenu(row)}
						/>
					</div>
				{/each}
			</div>
		{:else}
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
					Add a few exercises and you'll be able to run this routine start to finish.
				</p>
				<button class="btn btn-primary btn-sm mt-1" onclick={() => (showAdd = true)}>
					{@html AddIcon} Add exercises
				</button>
			</div>
		{/if}
	</div>
{:else}
	<div class="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
		<p class="font-semibold">That routine isn't available</p>
		<p class="text-base-content/50 text-sm">It may have been deleted on another device.</p>
		<a class="btn btn-primary btn-sm" href={libraryHref('routines')}>Back to Library</a>
	</div>
{/if}

<ActionSheet bind:open={showRoutineMenu} title={routine?.name} actions={routineActions} />
<ActionSheet bind:open={showRowMenu} title={selectedRow?.workout.name} actions={rowActions} />

<AddToPlanSheet
	bind:open={showAdd}
	exercises={available}
	onAddExercise={addExercise}
	onCreateExercise={createExercise}
/>

<TargetsSheet
	bind:open={showTargets}
	exerciseName={selectedRow?.workout.name}
	exercise={selectedRow?.ex}
	onSave={saveTargets}
/>

<EditRoutineSheet
	bind:open={showEditRoutine}
	{routine}
	onSave={(name, timer, notes) => routine && routines.update(routine.id, { name, timer, notes })}
/>

<ConfirmationDialog
	bind:dialog={removeExerciseDialog}
	header="Remove from routine?"
	content="This only removes it from this routine. The exercise and its history stay put."
	actionLabel="Remove"
	destructive
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default' && selectedRow) {
			removeExercise(selectedRow.workout.id);
		}
	}}
/>

<ConfirmationDialog
	bind:dialog={deleteRoutineDialog}
	header="Delete “{routine?.name ?? ''}”?"
	content="Your exercises and their history won't be affected."
	actionLabel="Delete"
	destructive
	onclose={async (e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default' && routine) {
			await routines.remove(routine.id);
			goto(libraryHref('routines'));
		}
	}}
/>
