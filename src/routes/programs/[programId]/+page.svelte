<script lang="ts">
	import { onMount } from 'svelte';
	import { counted, newId } from '$lib/utils';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { programs, user } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { training } from '$lib/logic/training.svelte';
	import { setPageNav } from '$lib/nav.svelte';
	import { DAY_FULL, DAY_NAMES } from '$lib/constants';
	import { historyItemHref, libraryHref, runProgramHref } from '$lib/routes';
	import {
		nextScheduledDay,
		orderedSessions,
		slotLabel,
		type ProgramDay,
		type ProgramItem,
		type ProgramSession,
		type Slot,
		type Workout
	} from '$lib/types';
	import { programDayName, sessionName, whenNext } from '$lib/logic/training';
	import { todayPlan } from '$lib/logic/today';
	import { logDuration, weekDays } from '$lib/logic/history';
	import { clampTarget } from '$lib/logic/targets';
	import {
		chipLabel,
		entryTarget,
		eyebrow,
		itemDetail,
		itemName,
		keyed,
		presentExercises as presentIn,
		programSummary,
		sessionViews,
		startButton,
		takenSlots,
		withSessions,
		type SessionView
	} from '$lib/logic/programWeek';
	import ActionSheet, { type SheetAction } from '$lib/components/ActionSheet.svelte';
	import AddToPlanSheet, { type PlanChange } from '$lib/components/AddToPlanSheet.svelte';
	import Chevron from '$lib/components/Chevron.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import EditProgramSheet from '$lib/components/EditProgramSheet.svelte';
	import NameSheet from '$lib/components/NameSheet.svelte';
	import SortableList from '$lib/components/SortableList.svelte';
	import SlotSheet, { slotIcon } from '$lib/components/SlotSheet.svelte';
	import RowMenuButton from '../../library/RowMenuButton.svelte';
	import WeekNav from './WeekNav.svelte';
	import AddIcon from '$lib/icons/add.svg?raw';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import CheckIcon from '$lib/icons/check.svg?raw';
	import NotesIcon from '$lib/icons/notes.svg?raw';
	import DownIcon from '$lib/icons/down.svg?raw';
	import RemoveIcon from '$lib/icons/remove.svg?raw';

	/**
	 * A program's week. It opens as a plan to read and start from, with only
	 * the day's next session in green; Edit turns on the controls for changing
	 * it (times of day, order, set counts, adding and removing).
	 */

	let program = $derived(session.program(page.params.programId));
	let isActive = $derived(session.activeProgramId === program?.id);
	let logs = $derived(session.sessionLogs ?? []);

	setPageNav(
		() => program?.name ?? '',
		() => libraryHref('programs')
	);

	const todayDow = new Date().getDay();
	/** Up next moves with the time-of-day slot, so the plan follows the clock by the minute. */
	let minute = $state(Date.now());
	onMount(() => {
		const t = setInterval(() => (minute = Date.now()), 60_000);
		return () => clearInterval(t);
	});

	let editing = $state(false);
	let selectedDay = $state(todayDow);
	let isToday = $derived(selectedDay === todayDow);
	let schedule = $derived<ProgramDay[]>(program?.schedule ?? []);
	let dayEntry = $derived(schedule.find((d) => d.day === selectedDay) ?? null);
	/** The day's sessions in slot order, empty ones too, so a new one can be filled in. */
	let sessions = $derived(orderedSessions(dayEntry));
	let multi = $derived(sessions.length > 1);

	let summary = $derived(program ? programSummary(program) : '');

	/**
	 * This program's week. Unlike Today's strip, only its own sessions fill a
	 * day: a set of something else doesn't tick off a day of this plan.
	 */
	let week = $derived(
		weekDays(program ?? null, logs, [], session.prefs.weekStart).map((d) => ({
			...d,
			trained: d.done > 0
		}))
	);

	// ── Viewing ─────────────────────────────────────────────────────────────────

	/** Where each of today's sessions stands; on any other day nothing has happened yet. */
	let todayRows = $derived(
		program && isToday ? todayPlan(program, todayDow, logs, training.session, minute) : []
	);

	let views = $derived(
		program
			? sessionViews(program.id, selectedDay, sessions, {
					lookups: training.lookups,
					prefs: session.prefs,
					logs,
					todayRows,
					liveStartedAt: training.session?.startedAt,
					canResume: (source) => !!training.endedToday(source),
					now: minute
				})
			: []
	);
	let doneCount = $derived(views.filter((v) => v.row?.status === 'done').length);

	function start(v: SessionView, opts?: { fresh?: boolean }) {
		goto(
			runProgramHref(v.source.programId, v.source.day, v.source.sessionId, {
				resume: v.resumable,
				...opts
			})
		);
	}

	let nextDay = $derived(program ? nextScheduledDay(program, selectedDay) : null);
	let nextUp = $derived(
		nextDay
			? {
					day: nextDay.day,
					name: programDayName(
						nextDay,
						(id) => session.routine(id),
						(id) => session.workout(id)
					),
					when: isToday ? whenNext(nextDay.day, todayDow) : DAY_FULL[nextDay.day]
				}
			: null
	);

	// ── Editing ─────────────────────────────────────────────────────────────────

	/** The session the add sheet, session menu and remove dialog act on. */
	let targetId = $state<string | null>(null);
	let target = $derived(sessions.find((s) => s.id === targetId) ?? null);
	let targetItems = $derived(target?.items ?? []);

	let presentExercises = $derived(presentIn(targetItems, training.lookups));
	let presentRoutineIds = $derived(
		targetItems.filter((i) => i.type === 'routine').map((i) => i.routineId)
	);

	let targetTitle = $derived(
		multi && target ? `${DAY_FULL[selectedDay]} · ${slotLabel(target.slot)}` : DAY_FULL[selectedDay]
	);

	// ── Sheets ──────────────────────────────────────────────────────────────────
	let showProgramMenu = $state(false);
	let showSessionMenu = $state(false);
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

	let selectedItemName = $derived(
		selectedItemIndex !== null && targetItems[selectedItemIndex]
			? itemName(targetItems[selectedItemIndex], training.lookups)
			: ''
	);

	/** What each slot already holds, so picking one says what it joins. */
	let taken = $derived(
		takenSlots(sessions, slotMode === 'change' ? targetId : null, training.lookups)
	);

	// No Edit here: the page's own Edit button sits right beside this menu.
	// Destructive actions come last, set apart by the sheet.
	let programActions = $derived<SheetAction[]>(
		[
			{
				label: isActive ? 'Deactivate program' : 'Set as active program',
				icon: CheckIcon,
				onSelect: () => user.setActiveProgram(isActive ? null : program!.id)
			},
			{ label: 'Name and notes', icon: EditIcon, onSelect: () => (showEditProgram = true) },
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

	// Its time is the chip, its order the handles, adding the row at its foot.
	let sessionActions = $derived<SheetAction[]>(
		target
			? [
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
				]
			: []
	);

	// ── Mutations ───────────────────────────────────────────────────────────────

	function saveSessions(next: ProgramSession[], create: Workout[] = []) {
		if (!program) return;
		return programs.saveSchedule(program.id, withSessions(schedule, selectedDay, next), create);
	}

	function patchSession(id: string, patch: (s: ProgramSession) => ProgramSession) {
		saveSessions(sessions.map((s) => (s.id === id ? patch(s) : s)));
	}

	function setItems(id: string, items: ProgramItem[]) {
		patchSession(id, (s) => ({ ...s, items }));
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
			: [...sessions, { id: newId(), items }];
		saveSessions(next, change.create);
	}

	function pickSlot(slot: Slot | undefined) {
		if (slotMode === 'change') {
			if (!target) return;
			patchSession(target.id, ({ slot: _old, ...rest }) => ({ ...rest, ...(slot && { slot }) }));
			return;
		}
		const created: ProgramSession = { id: newId(), ...(slot && { slot }), items: [] };
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
		if (target)
			setItems(
				target.id,
				targetItems.filter((_, i) => i !== index)
			);
	}

	function stepTargetSets(s: ProgramSession, index: number, delta: number) {
		setItems(
			s.id,
			s.items.map((it, i) =>
				i === index && it.type === 'exercise'
					? { ...it, targetSets: clampTarget(it.targetSets + delta) }
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

	function askRemove(s: ProgramSession, index: number) {
		targetId = s.id;
		selectedItemIndex = index;
		removeItemDialog?.showModal();
	}

	function editLabel(s: ProgramSession) {
		targetId = s.id;
		labelDraft = s.label ?? '';
		showLabelSheet = true;
	}
</script>

{#snippet check(cls: string)}
	<svg
		class={cls}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="3"
		aria-hidden="true"
		><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" /></svg
	>
{/snippet}

{#snippet plus(cls: string)}
	<span class={cls}>{@html AddIcon}</span>
{/snippet}

{#snippet slotEyebrow(s: ProgramSession, text: string)}
	<p
		class="text-base-content/65 flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase [&_svg]:h-3.5 [&_svg]:w-3.5"
	>
		{#if views.length > 1}{@html slotIcon(s.slot)}{/if}
		{text}
	</p>
{/snippet}

{#snippet sessionCard(v: SessionView)}
	{@const button = startButton(v, isToday)}
	{@const label = eyebrow(v, views.length)}
	<section class="bg-base-200 rounded-2xl" aria-label="{v.title} session">
		{#snippet head()}
			<div class="min-w-0 flex-1">
				{#if label}{@render slotEyebrow(v.session, label)}{/if}
				<h3 class={['text-[17px] leading-snug font-bold', label && 'mt-1']}>{v.title}</h3>
				<p class="text-base-content/65 text-sm">{v.meta}</p>
			</div>
		{/snippet}
		{#if v.routineId}
			<a
				class="hover:bg-base-300 flex items-center gap-3 rounded-t-2xl px-4 pt-4 pb-2.5 transition-colors"
				href="/routines/{v.routineId}"
			>
				{@render head()}
				<Chevron />
			</a>
		{:else}
			<div class="flex items-center gap-3 px-4 pt-4 pb-2.5">{@render head()}</div>
		{/if}
		<ul>
			{#each v.plan as entry, i (i)}
				{@const name = session.workout(entry.workoutId)?.name ?? '—'}
				{@const target = entryTarget(entry, training.lookups, session.prefs.distanceUnit)}
				<li>
					<a
						class="hover:bg-base-300 flex h-11 items-center gap-3 px-4 transition-colors"
						href="/workout/{entry.workoutId}?from=/programs/{v.source.programId}"
					>
						<span class="text-base-content/65 w-4 shrink-0 text-right text-xs tabular-nums"
							>{i + 1}</span
						>
						<span class="min-w-0 flex-1 truncate text-[15px]">{name}</span>
						{#if v.done[i]}
							<span class="text-primary-strong flex items-center gap-1 text-sm font-semibold">
								{@render check('h-4 w-4')} Done
							</span>
						{:else if target}
							<span class="text-base-content/65 shrink-0 text-sm tabular-nums">{target}</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
		<div class="px-4 pt-2 pb-4">
			<button
				class={[
					'btn h-12 w-full rounded-xl text-base',
					button.primary ? 'btn-primary' : 'bg-base-300 border-0'
				]}
				onclick={() => start(v)}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
					><path d="M7 4.5v15l12-7.5z" /></svg
				>
				{button.label}
			</button>
		</div>
	</section>
{/snippet}

{#snippet doneCard(v: SessionView)}
	{@const log = v.doneLog}
	<div class="bg-base-200 flex items-center gap-1 rounded-2xl pr-3">
		<a
			class="hover:bg-base-300 flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-3.5 pr-2 pl-4 transition-colors"
			href={log ? historyItemHref(log.id) : undefined}
			aria-label="{v.title}: done"
		>
			<span
				class="bg-primary text-primary-content flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
			>
				{@render check('h-4.5 w-4.5')}
			</span>
			<div class="min-w-0 flex-1">
				{#if views.length > 1}{@render slotEyebrow(v.session, slotLabel(v.session.slot))}{/if}
				<p class="truncate text-[17px] leading-snug font-bold">{v.title}</p>
				<p class="text-base-content/65 text-sm">
					{[
						'Done',
						...(log
							? [counted(log.totals.sets, 'set'), `${Math.round(logDuration(log) / 60_000)} min`]
							: [])
					].join(' · ')}
				</p>
			</div>
		</a>
		<!-- A second run is a fresh workout, never a resume of the finished one. -->
		<button
			class="btn btn-sm bg-base-300 shrink-0 rounded-full border-0"
			aria-label="Do {v.title} again"
			onclick={() => start(v, { fresh: true })}>Do again</button
		>
	</div>
{/snippet}

{#snippet editCard(s: ProgramSession)}
	<section class="bg-base-200 rounded-2xl" aria-label="{slotLabel(s.slot)} session">
		<div class="flex items-center justify-between gap-2 pt-3 pr-2 pl-4">
			<button
				class="btn btn-sm bg-base-300 gap-1.5 rounded-full border-0 pr-2.5 pl-3 [&_svg]:h-4 [&_svg]:w-4"
				aria-label="When: {slotLabel(s.slot)}. Change"
				onclick={() => changeSlot(s)}
			>
				{@html slotIcon(s.slot)}
				{chipLabel(s, multi)}
				<span class="text-base-content/65 [&>svg]:h-3.5 [&>svg]:w-3.5">{@html DownIcon}</span>
			</button>
			<RowMenuButton
				label="Options for the {slotLabel(s.slot).toLowerCase()} session"
				onclick={() => openSessionMenu(s)}
			/>
		</div>
		<button
			class="flex items-center gap-2 px-4 pt-2 pb-3 text-left text-[17px] font-bold [&>span>svg]:h-4 [&>span>svg]:w-4"
			aria-label="Rename session"
			onclick={() => editLabel(s)}
		>
			{s.items.length || s.label
				? sessionName(
						s,
						(id) => session.routine(id),
						(id) => session.workout(id)
					)
				: 'New session'}
			<span class="text-base-content/65">{@html EditIcon}</span>
		</button>
		{#if s.items.length}
			<div class="border-base-300 border-t">
				<SortableList
					items={keyed(s.items)}
					key={(row) => row.key}
					onReorder={(next) =>
						setItems(
							s.id,
							next.map((row) => row.item)
						)}
					disabled={s.items.length < 2}
					gap="gap-0"
				>
					{#snippet children({ item }, i)}
						{@const detail = itemDetail(item, training.lookups, session.prefs.distanceUnit)}
						<div class="flex min-h-14 items-center gap-2 py-1.5 pl-4">
							<a
								class="flex min-w-0 flex-1 flex-col"
								href={item.type === 'routine'
									? `/routines/${item.routineId}`
									: `/workout/${item.workoutId}?from=/programs/${program!.id}`}
							>
								<span class="truncate text-[15px]">{itemName(item, training.lookups)}</span>
								{#if detail}<span class="text-base-content/65 text-xs">{detail}</span>{/if}
							</a>
							{#if item.type === 'exercise'}
								<div class="bg-base-300 flex h-8 shrink-0 items-center rounded-full">
									<button
										class="text-base-content/75 flex h-8 w-8 items-center justify-center disabled:opacity-30 [&>svg]:h-3.5 [&>svg]:w-3.5"
										aria-label="Fewer sets of {itemName(item, training.lookups)}"
										disabled={item.targetSets <= 1}
										onclick={() => stepTargetSets(s, i, -1)}>{@html RemoveIcon}</button
									>
									<span class="min-w-11 text-center text-[13px] font-semibold tabular-nums"
										>{counted(item.targetSets, 'set')}</span
									>
									<button
										class="text-base-content/75 flex h-8 w-8 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5"
										aria-label="More sets of {itemName(item, training.lookups)}"
										onclick={() => stepTargetSets(s, i, 1)}>{@html AddIcon}</button
									>
								</div>
							{/if}
							<button
								class="text-error-strong flex h-11 w-9 shrink-0 items-center justify-center"
								aria-label="Remove {itemName(item, training.lookups)}"
								onclick={() => askRemove(s, i)}
							>
								<svg
									class="h-5 w-5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M8 12h8" /></svg
								>
							</button>
						</div>
					{/snippet}
				</SortableList>
			</div>
		{/if}
		<button
			class="border-base-300 text-primary-strong flex h-12 w-full items-center gap-2.5 border-t px-4 text-[15px] font-semibold"
			onclick={() => openAdd(s)}
		>
			{@render plus('[&>svg]:h-4.5 [&>svg]:w-4.5')}
			Add exercise or routine
		</button>
	</section>
{/snippet}

{#if session.programs === null}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-5">
		<div class="skeleton h-8 w-full rounded-xl"></div>
		<div class="skeleton h-19.5 w-full rounded-2xl"></div>
		<div class="skeleton h-72 w-full rounded-2xl"></div>
	</div>
{:else if program}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-5 pb-2">
		<section>
			<div class="flex min-h-10 items-center justify-between gap-2">
				{#if editing}
					<p class="text-base-content/65 text-sm">Editing · changes save as you go</p>
				{:else}
					<p class="text-base-content/65 flex min-w-0 items-center gap-1.5 text-sm">
						<span
							class={[
								'h-1.75 w-1.75 shrink-0 rounded-full',
								isActive ? 'bg-primary' : 'ring-base-content/40 ring-[1.5px] ring-inset'
							]}
						></span>
						<span class="truncate">
							{#if isActive}<b class="text-primary-strong font-semibold">Active</b>{:else}Not active{/if}
							· {summary}
						</span>
					</p>
				{/if}
				<div class="flex shrink-0 items-center gap-1">
					{#if !isActive && !editing}
						<button
							class="btn btn-sm bg-primary/15 text-primary-strong rounded-full border-0"
							onclick={() => user.setActiveProgram(program.id)}>Make active</button
						>
					{/if}
					<button
						class={[
							'btn btn-sm rounded-full border-0 px-4',
							editing ? 'btn-primary' : 'bg-base-200'
						]}
						onclick={() => (editing = !editing)}>{editing ? 'Done' : 'Edit'}</button
					>
					<RowMenuButton label="Program options" onclick={() => (showProgramMenu = true)} />
				</div>
			</div>
			{#if program.notes && !editing}
				<p class="text-base-content/70 mt-2 text-sm whitespace-pre-line">{program.notes}</p>
			{/if}
		</section>

		<WeekNav days={week} bind:selected={selectedDay} />

		<section class="flex flex-col gap-3" aria-label={DAY_FULL[selectedDay]}>
			<div class="flex items-baseline justify-between gap-3">
				<h2 class="text-xl font-bold">
					{DAY_FULL[selectedDay]}
					{#if isToday}
						<span
							class="bg-primary/15 text-primary-strong ml-1.5 rounded-full px-2 py-0.5 align-[3px] text-[11px] font-bold tracking-wide uppercase"
							>Today</span
						>
					{/if}
				</h2>
				{#if editing}
					{#if sessions.length}
						<span class="text-base-content/65 text-sm">{counted(sessions.length, 'session')}</span>
					{/if}
				{:else if views.length > 1}
					<span class="text-base-content/65 text-sm tabular-nums">
						{isToday ? `${doneCount} of ${views.length} done` : counted(views.length, 'session')}
					</span>
				{/if}
			</div>

			{#if editing}
				{#each sessions as s (s.id)}
					{@render editCard(s)}
				{/each}
				<button
					class="border-base-content/20 text-base-content/75 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed text-[15px] font-semibold"
					onclick={() => (sessions.length ? addSession() : openAdd(null))}
				>
					{@render plus('[&>svg]:h-4.5 [&>svg]:w-4.5')}
					{sessions.length ? 'Add another session' : 'Add a session'}
				</button>
				{#if sessions.length}
					<p class="text-base-content/65 px-6 text-center text-sm">
						Split a day into morning and evening sessions you start separately.
					</p>
				{/if}
			{:else if views.length}
				{#each views as v (v.session.id)}
					{#if v.row?.status === 'done'}
						{@render doneCard(v)}
					{:else}
						{@render sessionCard(v)}
					{/if}
				{/each}
			{:else}
				<!-- The same rest card as Today: a rest day is part of the plan, not a gap. -->
				<div class="bg-base-200 flex flex-col gap-3.5 rounded-2xl p-4">
					<div class="flex items-center gap-3.5">
						<span
							class="bg-base-300 text-base-content/70 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
						>
							<svg
								class="h-5.5 w-5.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" /></svg
							>
						</span>
						<div>
							<p class="text-[17px] leading-snug font-bold">Rest day</p>
							<p class="text-base-content/65 text-sm">
								Nothing planned for {DAY_FULL[selectedDay]}.
							</p>
						</div>
					</div>
					{#if nextUp && nextUp.day !== selectedDay}
						<button
							class="bg-base-100/40 hover:bg-base-300 flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors"
							onclick={() => (selectedDay = nextUp.day)}
						>
							<div class="min-w-0 flex-1">
								<p class="text-base-content/65 text-sm">Next up · {nextUp.when}</p>
								<p class="truncate font-semibold">{nextUp.name}</p>
							</div>
							<Chevron />
						</button>
					{/if}
				</div>
				<button
					class="text-primary-strong flex h-11 w-full items-center justify-center gap-2 text-[15px] font-semibold"
					onclick={() => openAdd(null)}
				>
					{@render plus('[&>svg]:h-4.5 [&>svg]:w-4.5')}
					Plan a session for {DAY_FULL[selectedDay]}
				</button>
			{/if}
		</section>
	</div>
{:else}
	<div class="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
		<p class="font-semibold">That program isn't available</p>
		<p class="text-base-content/65 text-sm">It may have been deleted on another device.</p>
		<a class="btn btn-primary btn-sm" href={libraryHref('programs')}>Back to Library</a>
	</div>
{/if}

<ActionSheet bind:open={showProgramMenu} title={program?.name} actions={programActions} />
<ActionSheet
	bind:open={showSessionMenu}
	title={target ? `${slotLabel(target.slot)} session` : ''}
	actions={sessionActions}
/>

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
	header="Remove {selectedItemName || 'this'} from {targetTitle}?"
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
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default' && program) {
			// Leave first: not awaited (it'd never return offline), and the page
			// shouldn't flash "not found" as the local delete lands. Deleted
			// even if that navigation doesn't complete: it was confirmed.
			const id = program.id;
			goto(libraryHref('programs'))
				.finally(() => programs.remove(id))
				.catch(() => {});
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
