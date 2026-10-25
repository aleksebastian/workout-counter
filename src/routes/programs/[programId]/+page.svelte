<script lang="ts">
	import { v4 as uuidv4 } from 'uuid';
	import { counted } from '$lib/utils';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { programs, user } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { setPageNav } from '$lib/nav.svelte';
	import { DAY_FULL, DAY_NAMES } from '$lib/constants';
	import { libraryHref, runProgramHref } from '$lib/routes';
	import {
		daySessions,
		orderedSessions,
		slotLabel,
		SLOT_LABEL,
		type ProgramDay,
		type ProgramItem,
		type ProgramSession,
		type Slot,
		type Workout
	} from '$lib/types';
	import { sessionName } from '$lib/logic/training';
	import ActionSheet, { type SheetAction } from '$lib/components/ActionSheet.svelte';
	import AddToPlanSheet, { type PlanChange } from '$lib/components/AddToPlanSheet.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import EditProgramSheet from '$lib/components/EditProgramSheet.svelte';
	import NameSheet from '$lib/components/NameSheet.svelte';
	import SortableList from '$lib/components/SortableList.svelte';
	import SlotSheet, { slotIcon } from '$lib/components/SlotSheet.svelte';
	import RowMenuButton from '../../library/RowMenuButton.svelte';
	import AddIcon from '$lib/icons/add.svg?raw';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import DragIndicatorIcon from '$lib/icons/drag_indicator.svg?raw';
	import CheckIcon from '$lib/icons/check.svg?raw';
	import NotesIcon from '$lib/icons/notes.svg?raw';
	import ClockIcon from '$lib/icons/clock.svg?raw';
	import DownIcon from '$lib/icons/down.svg?raw';

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
	/** The day's sessions in slot order, empty ones too, so a new one can be filled in. */
	let sessions = $derived(orderedSessions(dayEntry));
	let multi = $derived(sessions.length > 1);

	/** The session the add sheet, session menu and item menu act on. */
	let targetId = $state<string | null>(null);
	let target = $derived(sessions.find((s) => s.id === targetId) ?? null);
	let targetItems = $derived(target?.items ?? []);

	/**
	 * What the add sheet shows as already in the session: exercises scheduled
	 * directly (removable there), then those that come with a scheduled routine
	 * (shown for context — removing one means removing the routine).
	 */
	let presentExercises = $derived.by(() => {
		const direct = targetItems.flatMap((item) =>
			item.type === 'exercise' ? [{ workoutId: item.workoutId, removable: true }] : []
		);
		const seen = new Set(direct.map((p) => p.workoutId));
		const viaRoutines = targetItems.flatMap((item) => {
			if (item.type !== 'routine') return [];
			const routine = session.routine(item.routineId);
			return (routine?.exercises ?? []).flatMap((ex) => {
				if (seen.has(ex.workoutId)) return [];
				seen.add(ex.workoutId);
				return [{ workoutId: ex.workoutId, removable: false, note: `In ${routine!.name}` }];
			});
		});
		return [...direct, ...viaRoutines];
	});
	let presentRoutineIds = $derived(
		targetItems.filter((i) => i.type === 'routine').map((i) => i.routineId)
	);

	function setsToday(workoutId: string): number {
		return (
			session.workout(workoutId)?.sets.filter((s) => new Date(s.date).toDateString() === todayStr)
				.length ?? 0
		);
	}

	/** Flat exercise count, expanding routines. */
	function countExercises(items: ProgramItem[]): number {
		return items.reduce((sum, item) => {
			if (item.type === 'exercise') return sum + 1;
			return sum + (session.routine(item.routineId)?.exercises.length ?? 0);
		}, 0);
	}

	/** Exercises that have had their sets today. */
	function countDone(items: ProgramItem[]): number {
		return items.reduce((sum, item) => {
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
		}, 0);
	}

	/** A day with one session keeps the page-wide Start button it has always had. */
	let only = $derived(sessions.length === 1 ? sessions[0] : null);
	let totalToday = $derived(only ? countExercises(only.items) : 0);
	let doneToday = $derived(only ? countDone(only.items) : 0);

	/** A lone session without a slot doesn't need one; its chip invites setting it. */
	function chipLabel(s: ProgramSession): string {
		return !s.slot && !multi ? 'Set a time' : slotLabel(s.slot);
	}
	function addLabel(s: ProgramSession): string {
		return s.slot ? `Add to ${SLOT_LABEL[s.slot].toLowerCase()}` : 'Add to session';
	}
	let targetTitle = $derived(
		multi && target ? `${DAY_FULL[selectedDay]} · ${slotLabel(target.slot)}` : DAY_FULL[selectedDay]
	);

	// ── Sheets ──────────────────────────────────────────────────────────────────
	let reorderingId = $state<string | null>(null);
	let showProgramMenu = $state(false);
	let showSessionMenu = $state(false);
	let showItemMenu = $state(false);
	let showAdd = $state(false);
	let showSlots = $state(false);
	/** `add`: the slot sheet makes a new session; `change`: it moves the target. */
	let slotMode = $state<'add' | 'change'>('add');
	let showEditProgram = $state(false);
	let showLabelSheet = $state(false);
	let labelDraft = $state('');
	let deleteProgramDialog = $state<HTMLDialogElement>()!;
	let clearDayDialog = $state<HTMLDialogElement>()!;
	let removeItemDialog = $state<HTMLDialogElement>()!;
	let deleteSessionDialog = $state<HTMLDialogElement>()!;
	let selectedItemIndex = $state<number | null>(null);

	let selectedItem = $derived(
		selectedItemIndex === null ? null : (targetItems[selectedItemIndex] ?? null)
	);
	let selectedItemName = $derived(
		selectedItem === null
			? ''
			: selectedItem.type === 'routine'
				? (session.routine(selectedItem.routineId)?.name ?? 'Routine')
				: (session.workout(selectedItem.workoutId)?.name ?? 'Exercise')
	);

	/** What each slot already holds, so picking one says what it joins. */
	let taken = $derived.by(() => {
		const notes: Partial<Record<Slot | 'anytime', string>> = {};
		for (const s of sessions) {
			if (slotMode === 'change' && s.id === targetId) continue;
			if (!s.items.length) continue;
			const key = s.slot ?? 'anytime';
			notes[key] ??= `Has ${sessionName(s, (id) => session.routine(id))}`;
		}
		return notes;
	});

	// No "Start workout" here: the page's own Start buttons show under the same
	// condition. Destructive actions come last, set apart by the sheet.
	let programActions = $derived<SheetAction[]>(
		[
			{
				label: isActive ? 'Deactivate program' : 'Set as active program',
				icon: CheckIcon,
				onSelect: () => user.setActiveProgram(isActive ? null : program!.id)
			},
			{ label: `Add session to ${DAY_NAMES[selectedDay]}`, icon: AddIcon, onSelect: addSession },
			{ label: 'Edit program', icon: EditIcon, onSelect: () => (showEditProgram = true) },
			sessions.length
				? {
						label: `Clear ${DAY_NAMES[selectedDay]}`,
						icon: DeleteIcon,
						destructive: true,
						onSelect: () => clearDayDialog?.showModal()
					}
				: null,
			{
				label: 'Delete program',
				icon: DeleteIcon,
				destructive: true,
				onSelect: () => deleteProgramDialog?.showModal()
			}
		].filter((a) => a !== null)
	);

	let sessionActions = $derived<SheetAction[]>(
		target
			? [
					{ label: addLabel(target), icon: AddIcon, onSelect: () => (showAdd = true) },
					target.items.length > 1
						? {
								label: 'Reorder',
								icon: DragIndicatorIcon,
								onSelect: () => (reorderingId = target!.id)
							}
						: null,
					{
						label: 'Change time',
						icon: ClockIcon,
						onSelect: () => {
							slotMode = 'change';
							showSlots = true;
						}
					},
					{
						label: target.label ? 'Rename' : 'Add a label',
						icon: NotesIcon,
						onSelect: () => {
							labelDraft = target!.label ?? '';
							showLabelSheet = true;
						}
					},
					{
						label: 'Delete session',
						icon: DeleteIcon,
						destructive: true,
						onSelect: () =>
							target!.items.length ? deleteSessionDialog?.showModal() : removeSession(target!.id)
					}
				].filter((a) => a !== null)
			: []
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
				label: multi ? 'Remove from session' : 'Remove from day',
				icon: DeleteIcon,
				destructive: true,
				onSelect: () => removeItemDialog?.showModal()
			}
		].filter((a) => a !== null)
	);

	// ── Mutations ───────────────────────────────────────────────────────────────

	/** The schedule with one day's sessions replaced, dropping the day when none are left. */
	function withSessions(day: number, next: ProgramSession[]): ProgramDay[] {
		if (next.length === 0) return schedule.filter((d) => d.day !== day);
		const entry: ProgramDay = { day, sessions: next };
		return schedule.some((d) => d.day === day)
			? schedule.map((d) => (d.day === day ? entry : d))
			: [...schedule, entry].sort((a, b) => a.day - b.day);
	}

	function saveSessions(next: ProgramSession[], create: Workout[] = []) {
		if (!program) return;
		return programs.saveSchedule(program.id, withSessions(selectedDay, next), create);
	}

	function patchSession(id: string, patch: (s: ProgramSession) => ProgramSession) {
		saveSessions(sessions.map((s) => (s.id === id ? patch(s) : s)));
	}

	function setItems(items: ProgramItem[]) {
		if (target) patchSession(target.id, (s) => ({ ...s, items }));
	}

	/**
	 * One batch: new exercise documents and the session that points at them
	 * land together, so a session can never reference a missing exercise. With
	 * nothing scheduled yet, the first add makes the day's session.
	 */
	function applyChange(change: PlanChange) {
		if (!program) return;
		const kept = targetItems.filter((i) =>
			i.type === 'routine'
				? !change.remove.routines.includes(i.routineId)
				: !change.remove.exercises.includes(i.workoutId)
		);
		const added = change.add.map((a): ProgramItem =>
			a.type === 'routine'
				? { type: 'routine', routineId: a.routineId }
				: { type: 'exercise', workoutId: a.workoutId, targetSets: 3 }
		);
		const items = [...kept, ...added];
		const next = target
			? sessions.map((s) => (s.id === target!.id ? { ...s, items } : s))
			: [...sessions, { id: uuidv4(), items }];
		saveSessions(next, change.create);
	}

	function pickSlot(slot: Slot | undefined) {
		if (slotMode === 'change') {
			if (!target) return;
			patchSession(target.id, ({ slot: _old, ...rest }) => ({ ...rest, ...(slot && { slot }) }));
			return;
		}
		const created: ProgramSession = { id: uuidv4(), ...(slot && { slot }), items: [] };
		saveSessions([...sessions, created]);
		targetId = created.id;
		showAdd = true;
	}

	function addSession() {
		slotMode = 'add';
		showSlots = true;
	}

	function removeSession(id: string) {
		saveSessions(sessions.filter((s) => s.id !== id));
	}

	function saveLabel(label: string) {
		if (!target) return;
		patchSession(target.id, ({ label: _old, ...rest }) => ({
			...rest,
			...(label.trim() && { label: label.trim() })
		}));
	}

	function removeItem(index: number) {
		setItems(targetItems.filter((_, i) => i !== index));
	}

	function stepTargetSets(index: number, delta: number) {
		const item = targetItems[index];
		if (item?.type !== 'exercise') return;
		setItems(
			targetItems.map((it, i) =>
				i === index && it.type === 'exercise'
					? { ...it, targetSets: Math.max(1, Math.min(99, it.targetSets + delta)) }
					: it
			)
		);
	}

	function openSessionMenu(s: ProgramSession) {
		targetId = s.id;
		showSessionMenu = true;
	}

	function openAdd(s: ProgramSession | null) {
		targetId = s?.id ?? null;
		showAdd = true;
	}

	function changeSlot(s: ProgramSession) {
		targetId = s.id;
		slotMode = 'change';
		showSlots = true;
	}

	function openItemMenu(s: ProgramSession, index: number) {
		targetId = s.id;
		selectedItemIndex = index;
		showItemMenu = true;
	}

	function startSession(s: ProgramSession) {
		if (program) goto(runProgramHref(program.id, selectedDay, s.id));
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
								<span class="text-base-content/30 text-xs"
									>{done > 0 ? counted(done, 'set') : '—'}</span
								>
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
					<span>{counted(item.targetSets, 'set')} planned</span>
				{/if}
			</div>
		</div>
		<span class="badge badge-ghost badge-sm shrink-0 self-center"
			>{counted(item.targetSets, 'set')}</span
		>
	{/if}
{/snippet}

{#snippet sessionItems(s: ProgramSession)}
	{#if reorderingId === s.id}
		<p class="text-primary-strong py-2 text-sm font-medium">Drag the handles to reorder.</p>
		<SortableList
			items={s.items}
			key={(item) => (item.type === 'routine' ? item.routineId : item.workoutId)}
			onReorder={(next) => patchSession(s.id, (old) => ({ ...old, items: next }))}
		>
			{#snippet children(item)}
				<div class="bg-base-100 rounded-box flex items-start gap-3 px-4 py-3">
					{@render itemBody(item)}
				</div>
			{/snippet}
		</SortableList>
		<button class="btn btn-primary btn-sm my-2 w-full" onclick={() => (reorderingId = null)}
			>Done</button
		>
	{:else}
		<ul class="flex flex-col">
			{#each s.items as item, i (i)}
				<li class="border-base-300 flex items-start gap-2 border-t py-3">
					{@render itemBody(item)}
					<RowMenuButton label="Options for this item" onclick={() => openItemMenu(s, i)} />
				</li>
			{/each}
		</ul>
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

		<!-- Day picker. Today's ring is inset: the row scrolls sideways, which
		     clips anything drawn outside a button's edge. One dot per session. -->
		<div class="-mr-2 flex items-center gap-1.5 overflow-x-auto pr-2 pb-0.5">
			{#each [0, 1, 2, 3, 4, 5, 6] as dayNum (dayNum)}
				{@const dots = daySessions(schedule.find((d) => d.day === dayNum)).length}
				<div class="flex shrink-0 flex-col items-center">
					<button
						class="btn btn-sm"
						class:btn-primary={selectedDay === dayNum}
						class:btn-ghost={selectedDay !== dayNum}
						class:ring-2={dayNum === todayDow && selectedDay !== dayNum}
						class:ring-inset={dayNum === todayDow && selectedDay !== dayNum}
						class:ring-primary={dayNum === todayDow && selectedDay !== dayNum}
						aria-label="{DAY_FULL[dayNum]} — {counted(dots, 'session')}"
						onclick={() => {
							selectedDay = dayNum;
							reorderingId = null;
						}}
					>
						{DAY_NAMES[dayNum]}
					</button>
					<span class="mt-0.5 flex h-1.5 gap-0.5">
						{#each { length: Math.min(dots, 4) } as _, i (i)}
							<span class="bg-primary h-1.5 w-1.5 rounded-full"></span>
						{/each}
					</span>
				</div>
			{/each}
		</div>

		<!-- Start CTA, for a day with one session -->
		{#if only && totalToday > 0}
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
					onclick={() => startSession(only!)}
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

		{#if sessions.length}
			<div class="flex flex-col gap-3 pb-2">
				{#each sessions as s (s.id)}
					{@const count = countExercises(s.items)}
					<section
						class="bg-base-200 rounded-box flex flex-col px-4 pt-2"
						aria-label="{slotLabel(s.slot)} session"
					>
						<div class="flex min-h-11 items-center gap-2">
							<button
								class="btn btn-sm bg-base-300 gap-1.5 border-0 pr-2.5 pl-3 [&_svg]:h-4 [&_svg]:w-4"
								aria-label="When: {slotLabel(s.slot)}. Change"
								onclick={() => changeSlot(s)}
							>
								{@html slotIcon(s.slot)}
								{chipLabel(s)}
								<span class="[&>svg]:h-3.5 [&>svg]:w-3.5">{@html DownIcon}</span>
							</button>
							{#if count}
								<span class="text-base-content/50 text-xs">{counted(count, 'exercise')}</span>
							{/if}
							<span class="flex-1"></span>
							{#if multi && s.items.length}
								<button class="btn btn-ghost btn-sm" onclick={() => startSession(s)}>Start</button>
							{/if}
							<RowMenuButton
								label="Options for the {slotLabel(s.slot).toLowerCase()} session"
								onclick={() => openSessionMenu(s)}
							/>
						</div>
						{#if s.label}
							<p class="text-base-content/60 pb-2 text-sm font-medium">{s.label}</p>
						{/if}
						{@render sessionItems(s)}
						<button
							class="border-base-300 text-primary-strong flex h-11 items-center gap-2 border-t text-sm font-semibold [&>svg]:h-4.5 [&>svg]:w-4.5"
							onclick={() => openAdd(s)}
						>
							{@html AddIcon}
							{addLabel(s)}
						</button>
					</section>
				{/each}
				<button
					class="btn border-base-300 w-full border-dashed bg-transparent"
					onclick={addSession}
				>
					{@html AddIcon} Add session
				</button>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-3 py-12 text-center">
				<p class="text-base-content/50 text-sm">Nothing scheduled for {DAY_FULL[selectedDay]}.</p>
				<button class="btn btn-primary btn-sm" onclick={() => openAdd(null)}>
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
<ActionSheet
	bind:open={showSessionMenu}
	title={target ? `${slotLabel(target.slot)} session` : ''}
	actions={sessionActions}
/>
<ActionSheet bind:open={showItemMenu} title={selectedItemName} actions={itemActions} />

<SlotSheet
	bind:open={showSlots}
	title={slotMode === 'add' ? 'Add session' : 'Change time'}
	subtitle="{DAY_FULL[selectedDay]} · pick when you'll do it"
	{taken}
	current={slotMode === 'change' && target ? (target.slot ?? 'anytime') : null}
	onPick={pickSlot}
/>

<AddToPlanSheet
	bind:open={showAdd}
	title="Add to {targetTitle}"
	presentLabel="In this session"
	{presentExercises}
	routines={{ all: session.routines ?? [], present: presentRoutineIds }}
	onSave={applyChange}
/>

<EditProgramSheet
	bind:open={showEditProgram}
	{program}
	onSave={(name, notes) => program && programs.update(program.id, { name, notes })}
/>

<ConfirmationDialog
	bind:dialog={removeItemDialog}
	header="Remove from {targetTitle}?"
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
	bind:dialog={deleteSessionDialog}
	header="Delete the {target ? slotLabel(target.slot).toLowerCase() : ''} session?"
	content="This only changes the schedule. Nothing else is deleted."
	actionLabel="Delete session"
	destructive
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default' && target) {
			removeSession(target.id);
		}
	}}
/>

<ConfirmationDialog
	bind:dialog={clearDayDialog}
	header="Clear {DAY_FULL[selectedDay]}?"
	content="Removes every session scheduled for this day."
	actionLabel="Clear day"
	destructive
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default') saveSessions([]);
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
	title="Label this session"
	placeholder="e.g. Upper Hypertrophy"
	submitLabel="Save"
	initialValue={labelDraft}
	onSave={saveLabel}
/>
