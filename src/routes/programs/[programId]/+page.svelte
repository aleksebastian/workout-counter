<script lang="ts">
	import { v4 as uuidv4 } from 'uuid';
	import { counted } from '$lib/utils';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { programs, user } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { training } from '$lib/logic/training.svelte';
	import { setPageNav } from '$lib/nav.svelte';
	import { DAY_FULL, DAY_NAMES } from '$lib/constants';
	import { historyItemHref, libraryHref, runProgramHref } from '$lib/routes';
	import {
		daySessions,
		nextScheduledDay,
		orderedSessions,
		programDays,
		slotLabel,
		type ProgramDay,
		type ProgramItem,
		type ProgramSession,
		type SessionSource,
		type Slot,
		type Workout
	} from '$lib/types';
	import {
		buildPlan,
		entriesDone,
		programDayName,
		sessionName,
		targetLabel,
		whenNext,
		type PlanEntry
	} from '$lib/logic/training';
	import { todayPlan, type PlanRow } from '$lib/logic/today';
	import { estimateMinutes, logDuration, weekDays } from '$lib/logic/history';
	import { durationMs, pickRest } from '$lib/logic/rest';
	import { measureOf, measureTarget } from '$lib/logic/measure';
	import { clampTarget } from '$lib/logic/targets';
	import ActionSheet, { type SheetAction } from '$lib/components/ActionSheet.svelte';
	import AddToPlanSheet, { type PlanChange } from '$lib/components/AddToPlanSheet.svelte';
	import Chevron from '$lib/components/Chevron.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import DayRing, { dayLabel } from '$lib/components/DayRing.svelte';
	import EditProgramSheet from '$lib/components/EditProgramSheet.svelte';
	import NameSheet from '$lib/components/NameSheet.svelte';
	import SortableList from '$lib/components/SortableList.svelte';
	import SlotSheet, { slotIcon } from '$lib/components/SlotSheet.svelte';
	import RowMenuButton from '../../library/RowMenuButton.svelte';
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

	let editing = $state(false);
	let selectedDay = $state(todayDow);
	let isToday = $derived(selectedDay === todayDow);
	let schedule = $derived<ProgramDay[]>(program?.schedule ?? []);
	let dayEntry = $derived(schedule.find((d) => d.day === selectedDay) ?? null);
	/** The day's sessions in slot order, empty ones too, so a new one can be filled in. */
	let sessions = $derived(orderedSessions(dayEntry));
	let multi = $derived(sessions.length > 1);

	let dayCount = $derived(program ? programDays(program).length : 0);
	let sessionCount = $derived(schedule.reduce((n, d) => n + daySessions(d).length, 0));
	/** "3 days a week", and how many sessions when some days have more than one. */
	let summary = $derived(
		[
			dayCount ? `${counted(dayCount, 'day')} a week` : 'nothing planned yet',
			sessionCount > dayCount ? counted(sessionCount, 'session') : null
		]
			.filter(Boolean)
			.join(' · ')
	);

	let week = $derived(
		weekDays(
			program ?? null,
			logs,
			(session.workouts ?? []).flatMap((w) => w.sets.map((s) => Date.parse(s.date))),
			session.prefs.weekStart
		)
	);

	// ── Viewing ─────────────────────────────────────────────────────────────────

	/** Where each of today's sessions stands; on any other day nothing has happened yet. */
	let todayRows = $derived(
		program && isToday ? todayPlan(program, todayDow, logs, training.session, Date.now()) : []
	);

	function restSeconds(e: PlanEntry): number {
		const rest = pickRest(session.routine(e.routineId), session.prefs);
		return rest ? durationMs(rest.duration) / 1000 : 0;
	}

	type SessionView = {
		session: ProgramSession;
		source: Extract<SessionSource, { type: 'program' }>;
		plan: PlanEntry[];
		title: string;
		/** The routine a session is made of, when it's exactly one, to open from its header. */
		routineId: string | null;
		meta: string;
		/** Today's run of it, if any. */
		row: PlanRow | null;
		/** Per plan entry, whether today's run got its sets; empty when there's no run. */
		done: boolean[];
	};

	/** Sessions with something in them, ready to read. */
	let views = $derived.by((): SessionView[] => {
		if (!program) return [];
		return sessions
			.filter((s) => s.items.length > 0)
			.map((s) => {
				const source = {
					type: 'program',
					programId: program!.id,
					day: selectedDay,
					sessionId: s.id
				} as const;
				const plan = buildPlan(source, training.lookups) ?? [];
				const only = s.items.length === 1 && s.items[0].type === 'routine' ? s.items[0] : null;
				const sets = plan.reduce((n, e) => n + (e.targetSets ?? 0), 0);
				const minutes = estimateMinutes(plan, restSeconds, logs, source).minutes;
				const row = todayRows.find((r) => r.session.id === s.id) ?? null;
				// Ticks only for the run under way or the one ended early.
				const since =
					row?.status === 'live'
						? training.session!.startedAt
						: row?.status === 'partial'
							? row.log?.startedAt
							: undefined;
				return {
					session: s,
					source,
					plan,
					title: sessionName(
						s,
						(id) => session.routine(id),
						(id) => session.workout(id)
					),
					routineId: only?.routineId ?? null,
					meta: [
						only ? 'Routine' : null,
						counted(plan.length, 'exercise'),
						sets ? counted(sets, 'set') : null,
						`about ${minutes} min`
					]
						.filter(Boolean)
						.join(' · '),
					row,
					done: since === undefined ? [] : entriesDone(plan, training.lookups, since)
				};
			});
	});
	let doneCount = $derived(views.filter((v) => v.row?.status === 'done').length);

	function eyebrow(v: SessionView): string {
		const status =
			v.row?.status === 'live'
				? 'In progress'
				: v.row?.status === 'partial'
					? 'Ended early'
					: v.row?.upNext
						? 'Up next'
						: null;
		return [views.length > 1 ? slotLabel(v.session.slot) : null, status]
			.filter(Boolean)
			.join(' · ');
	}

	/** Green only for what to do now: the session up next today, or the one under way. */
	function startButton(v: SessionView): { label: string; primary: boolean } {
		const row = v.row;
		if (row?.status === 'live') return { label: 'Continue', primary: true };
		if (row?.status === 'partial') return { label: 'Resume', primary: row.upNext };
		if (row?.upNext) return { label: `Start ${v.title}`, primary: true };
		return { label: isToday ? 'Start' : 'Start now', primary: false };
	}

	function start(v: SessionView) {
		const resume = v.row?.status === 'partial' && !!training.endedToday(v.source);
		goto(runProgramHref(v.source.programId, v.source.day, v.source.sessionId, { resume }));
	}

	function entryTarget(e: PlanEntry): string | null {
		return targetLabel(e, measureOf(session.workout(e.workoutId)), session.prefs.distanceUnit);
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

	/** A lone session without a slot doesn't need one; its chip invites setting it. */
	function chipLabel(s: ProgramSession): string {
		return !s.slot && !multi ? 'Set a time' : slotLabel(s.slot);
	}
	let targetTitle = $derived(
		multi && target ? `${DAY_FULL[selectedDay]} · ${slotLabel(target.slot)}` : DAY_FULL[selectedDay]
	);

	function itemName(item: ProgramItem): string {
		return item.type === 'routine'
			? (session.routine(item.routineId)?.name ?? 'Routine')
			: (session.workout(item.workoutId)?.name ?? 'Exercise');
	}

	/** Under an item's name while editing: what a routine holds, or an exercise's per-set target. */
	function itemDetail(item: ProgramItem): string | null {
		if (item.type === 'routine') {
			return `Routine · ${counted(session.routine(item.routineId)?.exercises.length ?? 0, 'exercise')}`;
		}
		const measure = measureOf(session.workout(item.workoutId));
		return measure === 'reps' ? null : measureTarget(item, measure, session.prefs.distanceUnit);
	}

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
			? itemName(targetItems[selectedItemIndex])
			: ''
	);

	/** What each slot already holds, so picking one says what it joins. */
	let taken = $derived.by(() => {
		const notes: Partial<Record<Slot | 'anytime', string>> = {};
		for (const s of sessions) {
			if (slotMode === 'change' && s.id === targetId) continue;
			if (!s.items.length) continue;
			const key = s.slot ?? 'anytime';
			notes[key] ??= `Has ${sessionName(
				s,
				(id) => session.routine(id),
				(id) => session.workout(id)
			)}`;
		}
		return notes;
	});

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
		class="text-base-content/55 flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase [&_svg]:h-3.5 [&_svg]:w-3.5"
	>
		{#if views.length > 1}{@html slotIcon(s.slot)}{/if}
		{text}
	</p>
{/snippet}

{#snippet sessionCard(v: SessionView)}
	{@const button = startButton(v)}
	{@const label = eyebrow(v)}
	<section class="bg-base-200 rounded-2xl" aria-label="{v.title} session">
		{#snippet head()}
			<div class="min-w-0 flex-1">
				{#if label}{@render slotEyebrow(v.session, label)}{/if}
				<h3 class={['text-[17px] leading-snug font-bold', label && 'mt-1']}>{v.title}</h3>
				<p class="text-base-content/55 text-sm">{v.meta}</p>
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
				{@const target = entryTarget(entry)}
				<li>
					<a
						class="hover:bg-base-300 flex h-11 items-center gap-3 px-4 transition-colors"
						href="/workout/{entry.workoutId}?from=/programs/{v.source.programId}"
					>
						<span class="text-base-content/35 w-4 shrink-0 text-right text-xs tabular-nums"
							>{i + 1}</span
						>
						<span class="min-w-0 flex-1 truncate text-[15px]">{name}</span>
						{#if v.done[i]}
							<span class="text-primary-strong flex items-center gap-1 text-sm font-semibold">
								{@render check('h-4 w-4')} Done
							</span>
						{:else if target}
							<span class="text-base-content/55 shrink-0 text-sm tabular-nums">{target}</span>
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
	{@const log = v.row!.log}
	<a
		class="bg-base-200 hover:bg-base-300 flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-colors"
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
			<p class="text-base-content/55 text-sm">
				{[
					'Done',
					...(log
						? [counted(log.totals.sets, 'set'), `${Math.round(logDuration(log) / 60_000)} min`]
						: [])
				].join(' · ')}
			</p>
		</div>
		<Chevron />
	</a>
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
				{chipLabel(s)}
				<span class="text-base-content/45 [&>svg]:h-3.5 [&>svg]:w-3.5">{@html DownIcon}</span>
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
			<span class="text-base-content/40">{@html EditIcon}</span>
		</button>
		{#if s.items.length}
			<div class="border-base-300 border-t">
				<SortableList
					items={s.items}
					key={(item) => (item.type === 'routine' ? item.routineId : item.workoutId)}
					onReorder={(next) => setItems(s.id, next)}
					disabled={s.items.length < 2}
					gap="gap-0"
				>
					{#snippet children(item, i)}
						{@const detail = itemDetail(item)}
						<div class="flex min-h-14 items-center gap-2 py-1.5 pl-4">
							<a
								class="flex min-w-0 flex-1 flex-col"
								href={item.type === 'routine'
									? `/routines/${item.routineId}`
									: `/workout/${item.workoutId}?from=/programs/${program!.id}`}
							>
								<span class="truncate text-[15px]">{itemName(item)}</span>
								{#if detail}<span class="text-base-content/50 text-xs">{detail}</span>{/if}
							</a>
							{#if item.type === 'exercise'}
								<div class="bg-base-300 flex h-8 shrink-0 items-center rounded-full">
									<button
										class="text-base-content/75 flex h-8 w-8 items-center justify-center disabled:opacity-30 [&>svg]:h-3.5 [&>svg]:w-3.5"
										aria-label="Fewer sets of {itemName(item)}"
										disabled={item.targetSets <= 1}
										onclick={() => stepTargetSets(s, i, -1)}>{@html RemoveIcon}</button
									>
									<span class="min-w-11 text-center text-[13px] font-semibold tabular-nums"
										>{counted(item.targetSets, 'set')}</span
									>
									<button
										class="text-base-content/75 flex h-8 w-8 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5"
										aria-label="More sets of {itemName(item)}"
										onclick={() => stepTargetSets(s, i, 1)}>{@html AddIcon}</button
									>
								</div>
							{/if}
							<button
								class="text-error flex h-11 w-9 shrink-0 items-center justify-center"
								aria-label="Remove {itemName(item)}"
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
					<p class="text-base-content/55 text-sm">Editing · changes save as you go</p>
				{:else}
					<p class="text-base-content/55 flex min-w-0 items-center gap-1.5 text-sm">
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

		<!-- The same rings as Today's week strip; the selected day gets the tint. -->
		<nav class="bg-base-200 grid grid-cols-7 gap-0.5 rounded-2xl p-2" aria-label="Days of the week">
			{#each week as day (day.start)}
				{@const selected = day.dow === selectedDay}
				<button
					class={[
						'flex h-15.5 flex-col items-center justify-center gap-1.5 rounded-xl text-[11px]',
						selected
							? 'bg-primary/15 text-primary-strong font-bold'
							: day.today
								? 'text-base-content font-bold'
								: 'text-base-content/45'
					]}
					aria-label={dayLabel(day)}
					aria-pressed={selected}
					onclick={() => (selectedDay = day.dow)}
				>
					<DayRing {day} />
					<span aria-hidden="true">{day.today ? 'Today' : DAY_NAMES[day.dow]}</span>
				</button>
			{/each}
		</nav>

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
						<span class="text-base-content/55 text-sm">{counted(sessions.length, 'session')}</span>
					{/if}
				{:else if views.length > 1}
					<span class="text-base-content/55 text-sm tabular-nums">
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
					<p class="text-base-content/55 px-6 text-center text-sm">
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
							class="bg-base-300 text-base-content/60 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
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
							<p class="text-base-content/55 text-sm">
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
								<p class="text-base-content/55 text-sm">Next up · {nextUp.when}</p>
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
