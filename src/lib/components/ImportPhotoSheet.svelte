<script lang="ts">
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { v4 as uuidv4 } from 'uuid';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { library, type ProgramChange } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { toaster } from '$lib/toast.svelte';
	import { getNameValidationMsg } from '$lib/utils';
	import { libraryItemHref } from '$lib/routes';
	import {
		loadCatalog,
		planImport,
		type AliasChoice,
		type Catalog,
		type ImportPlan
	} from '$lib/catalog';
	import { normalizeName } from '$lib/catalog/match';
	import {
		addSessions,
		andList,
		bundleIdFor,
		daysLabel,
		daysSentence,
		runsRoutine,
		weekOrder,
		draftBundle,
		NOTE_MAX,
		toDraft,
		type Draft,
		type DraftExercise,
		type Extraction
	} from '$lib/import/photo';
	import { measureTarget } from '$lib/logic/measure';
	import { repRange } from '$lib/logic/targets';
	import { photoToJpegBase64 } from '$lib/logic/resizeImage';
	import { ANYTIME, SLOTS, SLOT_LABEL, type Program, type Slot } from '$lib/types';
	import { DAY_FULL, DAY_NAMES } from '$lib/constants';
	import CameraIcon from '$lib/icons/camera.svg?raw';
	import Chevron from '$lib/components/Chevron.svelte';

	/**
	 * Import a workout from a photo: pick a photo and say what to do with it,
	 * the server reads it, and the user checks an editable draft before anything
	 * is saved. Saving goes through the catalog's import planner, so exercises
	 * match the library the same way a Discover add does.
	 */

	let { open = $bindable(false) }: { open?: boolean } = $props();

	type Step = 'pick' | 'reading' | 'review' | 'error';
	type Failure = 'unreadable' | 'limit' | 'offline' | 'failed';

	let step = $state<Step>('pick');
	let failure = $state<Failure>('failed');
	let file = $state<File | null>(null);
	let preview = $state<string | null>(null);
	let note = $state('');
	let draft = $state<Draft | null>(null);
	let aliasChoices = $state<Record<string, AliasChoice>>({});
	let catalog = $state<Catalog | null>(null);
	let saving = $state(false);
	let nameError = $state<string>();
	let programError = $state<string>();
	let showWhere = $state(false);
	let editing = $state<{ index: number; exercise: DraftExercise } | null>(null);
	let editOpen = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let controller: AbortController | null = null;

	// Every opening starts over; closing stops a read in flight.
	let wasOpen = false;
	$effect(() => {
		const isOpen = open;
		untrack(() => {
			if (isOpen && !wasOpen) reset();
			if (!isOpen) controller?.abort();
		});
		wasOpen = isOpen;
	});

	function reset() {
		if (preview) URL.revokeObjectURL(preview);
		step = 'pick';
		file = null;
		preview = null;
		note = '';
		draft = null;
		saved = null;
		aliasChoices = {};
		nameError = undefined;
		programError = undefined;
	}

	function picked(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const chosen = input.files?.[0];
		// Cleared so picking the same photo again still fires a change.
		input.value = '';
		if (!chosen) return;
		if (preview) URL.revokeObjectURL(preview);
		file = chosen;
		preview = URL.createObjectURL(chosen);
		if (step === 'error') step = 'pick';
	}

	function fail(kind: Failure) {
		failure = kind;
		step = 'error';
	}

	async function read() {
		if (!file) return;
		if (!navigator.onLine) return fail('offline');
		step = 'reading';
		controller = new AbortController();
		const { signal } = controller;
		try {
			const image = await photoToJpegBase64(file);
			if (signal.aborted) return;
			const today = new Date().getDay();
			const res = await fetch('/api/import-photo', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ image, note, today }),
				signal
			});
			if (res.status === 429) return fail('limit');
			if (res.status === 422) return fail('unreadable');
			if (!res.ok) return fail('failed');
			const extraction = (await res.json()) as Extraction;
			catalog ??= await loadCatalog();
			if (signal.aborted) return;
			const next = toDraft(extraction, session.programs, today);
			if (extraction.status === 'unreadable' || !next.exercises.length) return fail('unreadable');
			draft = next;
			aliasChoices = {};
			step = 'review';
		} catch {
			if (signal.aborted) return;
			fail(navigator.onLine ? 'failed' : 'offline');
		}
	}

	function cancel() {
		controller?.abort();
		step = 'pick';
	}

	function suggest(text: string) {
		note = text;
	}

	// ── Review ────────────────────────────────────────────────────────────────

	/**
	 * The plan being written. Held while saving: the write lands in the library
	 * before the sheet closes, and re-planning against it would flash
	 * "already in your library" over the draft.
	 */
	let saved = $state<ImportPlan | null>(null);

	let plan = $derived.by(() => {
		if (saved) return saved;
		const lib = session.library;
		if (!draft || !catalog || !lib) return null;
		const { bundle, unstamped } = draftBundle(draft, catalog.exercises);
		if (!bundle.routines[0].exercises.length) return null;
		return planImport(bundle, lib, { unstamped, aliasChoices });
	});

	type Row = {
		index: number;
		name: string;
		/** What the photo said, when the name shown is different. */
		from?: string;
		targets: string;
		kind: 'library' | 'new' | 'alias';
		bundleId: string;
		mine?: string;
		/** Resolves to the same exercise as a row above it, so only that one is saved. */
		duplicate: boolean;
	};

	let rows = $derived.by((): Row[] => {
		if (!draft || !plan || !catalog) return [];
		const exercises = catalog.exercises;
		const seen = new Set<string>();
		return draft.exercises.map((ex, index) => {
			const bundleId = bundleIdFor(ex, exercises);
			const duplicate = seen.has(bundleId);
			seen.add(bundleId);
			const m = plan!.exercises.find((e) => e.exercise.id === bundleId);
			const name = m?.action === 'reuse' ? m.match!.workout.name : (m?.exercise.name ?? ex.name);
			return {
				index,
				name,
				...(normalizeName(name) !== normalizeName(ex.name) && { from: ex.name }),
				targets: targets(ex, m?.exercise.measure ?? ex.measure),
				kind:
					m?.match?.confidence === 'alias' ? 'alias' : m?.action === 'reuse' ? 'library' : 'new',
				bundleId,
				...(m?.match && { mine: m.match.workout.name }),
				duplicate
			};
		});
	});

	function targets(ex: DraftExercise, measure: DraftExercise['measure']): string {
		if (measure && measure !== 'reps') {
			const target = measureTarget(ex, measure, session.prefs.distanceUnit);
			return [ex.targetSets && measure !== 'hold' ? `${ex.targetSets} sets` : null, target]
				.filter(Boolean)
				.join(' · ');
		}
		const reps = repRange(ex);
		if (ex.targetSets && reps) return `${ex.targetSets} × ${reps}`;
		if (ex.targetSets) return `${ex.targetSets} sets`;
		return reps ? `${reps} reps` : '';
	}

	/** What will actually be saved: a duplicate row isn't. */
	let saveCount = $derived(rows.filter((r) => !r.duplicate).length);

	function choose(bundleId: string, choice: AliasChoice) {
		aliasChoices = { ...aliasChoices, [bundleId]: choice };
	}

	let savedName = $derived(plan?.create.routines[0]?.name);
	let nameHint = $derived.by(() => {
		if (!draft || !plan) return null;
		if (plan.alreadyInLibrary) return 'This routine is already in your library.';
		if (savedName && savedName !== draft.name.trim()) {
			return `You already have a ${draft.name.trim()}. This one saves as ${savedName}.`;
		}
		return null;
	});

	let destination = $derived(draft?.destination);
	let destProgram = $derived(
		destination?.type === 'program' && destination.programId
			? session.program(destination.programId)
			: null
	);
	let whereLabel = $derived.by(() => {
		const d = destination;
		if (!d || d.type === 'routines') return 'Routines';
		const name = destProgram?.name ?? (d.newProgramName.trim() || 'New program');
		const days = daysLabel(d.days, session.prefs.weekStart);
		return `${name} · ${days} · ${d.slot ? SLOT_LABEL[d.slot] : ANYTIME}`;
	});

	/** What's already in the chosen slot on the chosen days, so the user knows the routine goes after it. */
	let slotNote = $derived.by(() => {
		const d = destination;
		if (!d || d.type !== 'program' || !destProgram) return null;
		const routineId = plan?.root.id;
		const busy: number[] = [];
		const kept: number[] = [];
		const names = new Set<string>();
		let unnamed = 0;
		for (const day of d.days) {
			// A day that already runs this routine here is left as it is.
			if (routineId && runsRoutine(destProgram.schedule, day, d.slot, routineId)) {
				kept.push(day);
				continue;
			}
			const there = (destProgram.schedule.find((x) => x.day === day)?.sessions ?? []).filter(
				(s) => s.items.length && s.slot === d.slot
			);
			if (!there.length) continue;
			busy.push(day);
			for (const s of there) {
				const item = s.items[0];
				const name =
					s.label ??
					(item.type === 'routine'
						? session.routine(item.routineId)?.name
						: session.workout(item.workoutId)?.name);
				if (name) names.add(name);
				else unnamed++;
			}
		}
		const when = (days: number[]) =>
			daysSentence(days, session.prefs.weekStart) +
			(d.slot ? ` ${SLOT_LABEL[d.slot].toLowerCase()}${days.length > 1 ? 's' : ''}` : '');
		const have = (days: number[]) => (days.length > 1 ? 'have' : 'has');
		const notes: string[] = [];
		if (busy.length) {
			// A session that can't be named (its routine was deleted) is counted, not called "a session".
			const what = names.size
				? andList([...names, ...(unnamed ? [`${unnamed} more`] : [])])
				: unnamed > 1
					? 'other sessions'
					: 'another session';
			notes.push(`${when(busy)} already ${have(busy)} ${what}. This goes after it.`);
		}
		if (kept.length) {
			notes.push(
				`${when(kept)} already ${have(kept)} this routine, so ${kept.length > 1 ? 'they stay' : 'it stays'} as ${kept.length > 1 ? 'they are' : 'it is'}.`
			);
		}
		return notes.length ? notes.join(' ') : null;
	});

	function setDestination(next: Draft['destination']) {
		if (draft) draft.destination = next;
		programError = undefined;
	}

	function toProgram(programId: string | null) {
		const d = draft?.destination;
		const days = d?.type === 'program' ? d.days : [new Date().getDay()];
		const slot = d?.type === 'program' ? d.slot : undefined;
		const newProgramName = d?.type === 'program' ? d.newProgramName : '';
		setDestination({ type: 'program', programId, newProgramName, days, ...(slot && { slot }) });
	}

	/** Turns a day on or off; the last day left stays on, since the routine has to go somewhere. */
	function toggleDay(day: number) {
		const d = draft?.destination;
		if (d?.type !== 'program') return;
		if (!d.days.includes(day)) d.days = [...d.days, day].sort((a, b) => a - b);
		else if (d.days.length > 1) d.days = d.days.filter((x) => x !== day);
	}

	function setSlot(slot: Slot | undefined) {
		const d = draft?.destination;
		if (d?.type !== 'program') return;
		if (slot) d.slot = slot;
		else delete d.slot;
	}

	let isNew = $derived(destination?.type === 'program' && destination.programId === null);

	let programs = $derived(
		[...(session.programs ?? [])].sort(
			(a, b) => Number(b.id === session.activeProgramId) - Number(a.id === session.activeProgramId)
		)
	);

	function editRow(index: number) {
		if (!draft) return;
		editing = { index, exercise: { ...draft.exercises[index] } };
		editOpen = true;
	}

	function saveEdit() {
		if (!draft || !editing) return;
		const ex = editing.exercise;
		if (!ex.name.trim()) return;
		const clean = (n: number | undefined) =>
			n !== undefined && Number.isInteger(n) && n > 0 ? n : undefined;
		const next: DraftExercise = { ...ex, name: ex.name.trim() };
		for (const key of ['targetSets', 'minReps', 'maxReps'] as const) {
			const v = clean(next[key]);
			if (v === undefined) delete next[key];
			else next[key] = v;
		}
		draft.exercises[editing.index] = next;
		editOpen = false;
	}

	function removeRow() {
		if (!draft || !editing) return;
		draft.exercises.splice(editing.index, 1);
		editOpen = false;
	}

	async function save() {
		if (!draft || !plan || saving) return;
		// Nothing new to write: the same routine is already there.
		if (plan.alreadyInLibrary && draft.destination.type === 'routines') {
			open = false;
			goto(libraryItemHref('routine', plan.root.id));
			return;
		}
		if (!draft.name.trim()) {
			nameError = 'Routine name missing';
			return;
		}
		const routineId = plan.root.id;
		const d = draft.destination;
		let change: ProgramChange | undefined;
		let target = libraryItemHref('routine', routineId);

		// Days that get a new session; ones already running this routine there are skipped.
		let added = 0;
		if (d.type === 'program') {
			const existing = d.programId ? session.program(d.programId) : null;
			added = d.days.filter(
				(day) => !existing || !runsRoutine(existing.schedule, day, d.slot, routineId)
			).length;
			if (existing) {
				change = {
					type: 'schedule',
					programId: existing.id,
					schedule: addSessions(existing.schedule, d.days, d.slot, routineId)
				};
				target = libraryItemHref('program', existing.id);
			} else {
				programError = getNameValidationMsg('Program', d.newProgramName, session.programs);
				if (programError) {
					showWhere = true;
					return;
				}
				const program: Program = {
					id: uuidv4(),
					name: d.newProgramName.trim(),
					schedule: addSessions([], d.days, d.slot, routineId),
					createdAt: Date.now()
				};
				change = { type: 'create', program };
				target = libraryItemHref('program', program.id);
			}
		}

		saving = true;
		saved = plan;
		const ok = await library.add(plan, change);
		saving = false;
		if (!ok) {
			saved = null;
			return;
		}
		toaster.success(
			d.type === 'routines'
				? 'Routine saved'
				: added === 0
					? 'Already in your program on those days'
					: added > 1
						? `Added to ${added} days of your program`
						: 'Added to your program'
		);
		open = false;
		goto(target);
	}

	let saveLabel = $derived(
		destination?.type === 'program'
			? 'Add to program'
			: plan?.alreadyInLibrary
				? 'Open routine'
				: 'Save routine'
	);

	const FAILURES: Record<Failure, { title: string; body: string }> = {
		unreadable: {
			title: "Couldn't find a workout in this photo",
			body: 'Try a closer shot where the exercise names are easy to read.'
		},
		limit: {
			title: "That's today's imports",
			body: 'You can import 20 photos a day. Try again tomorrow, or build this one by hand.'
		},
		offline: {
			title: "You're offline",
			body: 'Reading a photo needs a connection. Your photo and note are still here.'
		},
		failed: {
			title: 'Something went wrong',
			body: "The photo couldn't be read this time. Try again in a moment."
		}
	};
</script>

<input
	bind:this={fileInput}
	type="file"
	accept="image/*"
	class="hidden"
	data-testid="import-photo-input"
	onchange={picked}
/>

{#snippet photo(scanning: boolean)}
	<div class="bg-base-200 relative h-56 overflow-hidden rounded-2xl">
		{#if preview}
			<!-- Contained, not cropped: a tall notebook page keeps its title in view. -->
			<img src={preview} alt="Your workout to import" class="h-full w-full object-contain" />
		{/if}
		{#if scanning}
			<div class="bg-base-100/40 absolute inset-0"></div>
			<div
				class="scanline bg-primary absolute inset-x-0 h-0.5 shadow-[0_0_12px_var(--color-primary)]"
			></div>
		{:else}
			<button
				class="btn btn-sm absolute right-2.5 bottom-2.5 rounded-full border-none bg-black/55 text-white"
				onclick={() => fileInput?.click()}>Change photo</button
			>
		{/if}
	</div>
{/snippet}

<BottomSheet
	bind:open
	size="large"
	title={step === 'review' ? 'Check your routine' : 'Import from photo'}
	autofocus={false}
>
	{#if step === 'pick'}
		<div class="flex flex-col gap-4">
			<p class="text-base-content/60 -mt-2 text-sm">You'll check everything before it's saved.</p>
			{#if preview}
				{@render photo(false)}
			{:else}
				<button
					class="border-base-300 hover:bg-base-200 flex h-56 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-colors"
					onclick={() => fileInput?.click()}
				>
					<span class="text-primary-strong bg-primary/15 rounded-full p-3 [&>svg]:h-6 [&>svg]:w-6"
						>{@html CameraIcon}</span
					>
					<span class="font-semibold">Choose a photo</span>
					<span class="text-base-content/50 text-sm">A screenshot, notebook page or whiteboard</span
					>
				</button>
			{/if}

			<div class="flex flex-col gap-2">
				<label
					for="import-note"
					class="text-base-content/60 text-xs font-semibold tracking-widest uppercase"
					>What should we do with it?</label
				>
				<textarea
					id="import-note"
					rows="2"
					maxlength={NOTE_MAX}
					class="textarea textarea-bordered w-full text-base"
					placeholder="e.g., Add this to my program on Monday morning"
					bind:value={note}></textarea>
				<div class="flex flex-wrap gap-1.5">
					<button class="btn btn-xs rounded-full" onclick={() => suggest('Add to my routines')}
						>Add to my routines</button
					>
					<button
						class="btn btn-xs rounded-full"
						onclick={() =>
							suggest(
								`Add to ${session.activeProgram ? `my ${session.activeProgram.name} program` : 'a new program'} on ${DAY_FULL[new Date().getDay()]}`
							)}>Add to a program day</button
					>
				</div>
			</div>
		</div>
	{:else if step === 'reading'}
		<div class="flex flex-col gap-4">
			{@render photo(true)}
			<div role="status" class="flex flex-col items-center gap-1 pt-3 text-center">
				<p class="font-semibold">Reading your workout…</p>
				<p class="text-base-content/60 text-sm">Usually takes a few seconds</p>
			</div>
		</div>
	{:else if step === 'error'}
		<div class="flex flex-col items-center gap-2.5 px-2 py-4 text-center">
			<span class="bg-base-200 text-base-content/60 rounded-full p-4 [&>svg]:h-7 [&>svg]:w-7"
				>{@html CameraIcon}</span
			>
			<p class="font-semibold">{FAILURES[failure].title}</p>
			<p class="text-base-content/60 max-w-xs text-sm">{FAILURES[failure].body}</p>
		</div>
	{:else if draft}
		<div class="flex flex-col gap-3">
			<p class="text-base-content/60 -mt-2 text-sm">From your photo · nothing is saved yet</p>
			<div class="bg-base-200 flex flex-col gap-1 rounded-2xl px-4 py-3">
				<label
					for="import-name"
					class="text-base-content/60 text-xs font-semibold tracking-widest uppercase">Name</label
				>
				<input
					id="import-name"
					class="bg-transparent text-base font-semibold outline-none"
					autocomplete="off"
					bind:value={draft.name}
					oninput={() => (nameError = undefined)}
				/>
				{#if nameError}
					<p class="text-error text-xs">{nameError}</p>
				{:else if nameHint}
					<p class="text-base-content/50 text-xs">{nameHint}</p>
				{/if}
			</div>
			<button
				class="bg-base-200 hover:bg-base-300 flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors"
				onclick={() => (showWhere = true)}
			>
				<span class="flex min-w-0 flex-1 flex-col gap-1">
					<span class="text-base-content/60 text-xs font-semibold tracking-widest uppercase"
						>Save to</span
					>
					<!-- Wraps rather than truncates: with several days, the time of day is at the end. -->
					<span class="font-medium">{whereLabel}</span>
				</span>
				<Chevron />
			</button>

			<div class="flex items-baseline justify-between px-1 pt-1">
				<p class="text-base-content/60 text-xs font-semibold tracking-widest uppercase">
					{saveCount}
					{saveCount === 1 ? 'exercise' : 'exercises'}
				</p>
				<p class="text-base-content/50 text-xs">Tap one to fix it</p>
			</div>
			<ul class="-mt-1 flex flex-col gap-0.5">
				{#each rows as row (row.index)}
					<li class={['rounded-xl', row.kind === 'alias' && !row.duplicate && 'bg-base-200 pb-2']}>
						<button
							class="hover:bg-base-200 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors"
							onclick={() => editRow(row.index)}
						>
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="truncate font-medium">{row.name}</span>
								<span class="text-base-content/50 truncate text-xs tabular-nums">
									{[
										row.duplicate ? 'Listed twice · only the first is kept' : row.targets,
										row.kind === 'alias'
											? `you log this as “${row.mine}”`
											: row.from && `from “${row.from}”`
									]
										.filter(Boolean)
										.join(' · ')}
								</span>
							</span>
							{#if row.duplicate}
								<span class="badge badge-warning badge-xs shrink-0">Duplicate</span>
							{:else if row.kind === 'library'}
								<span class="badge badge-xs bg-primary/15 text-primary-strong shrink-0 border-none"
									>In library</span
								>
							{:else if row.kind === 'new'}
								<span class="badge badge-ghost badge-xs shrink-0">New</span>
							{/if}
						</button>
						{#if row.kind === 'alias' && !row.duplicate}
							{@const choice = aliasChoices[row.bundleId] ?? 'mine'}
							<div class="bg-base-100 mx-2 grid grid-cols-2 gap-1 rounded-lg p-0.5">
								<button
									class={[
										'btn btn-xs h-8 border-none',
										choice === 'mine' ? 'bg-base-300' : 'btn-ghost'
									]}
									aria-pressed={choice === 'mine'}
									onclick={() => choose(row.bundleId, 'mine')}>Use my {row.mine}</button
								>
								<button
									class={[
										'btn btn-xs h-8 border-none',
										choice === 'new' ? 'bg-base-300' : 'btn-ghost'
									]}
									aria-pressed={choice === 'new'}
									onclick={() => choose(row.bundleId, 'new')}>Add as new</button
								>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex flex-col gap-1.5">
			{#if step === 'pick'}
				<button class="btn btn-primary btn-lg" disabled={!file} onclick={read}>Read workout</button>
				<p class="text-base-content/50 text-center text-xs">
					Your photo is sent to an AI service to read it, then deleted.
				</p>
			{:else if step === 'reading'}
				<button class="btn btn-ghost btn-lg" onclick={cancel}>Cancel</button>
			{:else if step === 'error'}
				{#if failure === 'unreadable'}
					<button class="btn btn-primary btn-lg" onclick={() => fileInput?.click()}
						>Try another photo</button
					>
				{:else if failure === 'limit'}
					<button class="btn btn-primary btn-lg" onclick={() => (open = false)}>Close</button>
				{:else}
					<button class="btn btn-primary btn-lg" onclick={read}>Try again</button>
					<button class="btn btn-ghost" onclick={() => (step = 'pick')}>Back</button>
				{/if}
			{:else}
				<button class="btn btn-primary btn-lg" disabled={!plan || saving} onclick={save}
					>{saveLabel}</button
				>
				<button class="btn btn-ghost" onclick={() => (step = 'pick')}>Back to photo</button>
			{/if}
		</div>
	{/snippet}
</BottomSheet>

<BottomSheet bind:open={showWhere} size="large" title="Where it goes">
	{#if destination}
		<div class="flex flex-col gap-4">
			<div class="flex flex-col gap-1.5">
				<p class="text-base-content/60 text-xs font-semibold tracking-widest uppercase">Program</p>
				<div class="flex flex-col">
					{#each programs as p (p.id)}
						{@const on = destination.type === 'program' && destination.programId === p.id}
						<button
							class={[
								'flex items-center gap-3 rounded-xl px-3 py-3 text-left',
								on ? 'bg-base-200' : 'hover:bg-base-200'
							]}
							aria-pressed={on}
							onclick={() => toProgram(p.id)}
						>
							<span
								class={[
									'grid size-6 shrink-0 place-items-center rounded-full',
									on ? 'bg-primary text-primary-content' : 'border-base-300 border-2'
								]}
								>{#if on}✓{/if}</span
							>
							<span class="flex-1 truncate font-medium">{p.name}</span>
							{#if p.id === session.activeProgramId}
								<span class="badge badge-xs bg-primary/15 text-primary-strong border-none"
									>Active</span
								>
							{/if}
						</button>
					{/each}
					<button
						class={[
							'flex items-center gap-3 rounded-xl px-3 py-3 text-left',
							isNew ? 'bg-base-200' : 'hover:bg-base-200'
						]}
						aria-pressed={isNew}
						onclick={() => toProgram(null)}
					>
						<span
							class={[
								'grid size-6 shrink-0 place-items-center rounded-full',
								isNew ? 'bg-primary text-primary-content' : 'border-base-300 border-2'
							]}
							>{#if isNew}✓{/if}</span
						>
						<span class="flex-1 font-medium">New program</span>
					</button>
					{#if destination.type === 'program' && destination.programId === null}
						<div class="px-3 pt-1 pb-2">
							<input
								class="input input-bordered w-full"
								placeholder="Program name"
								aria-label="New program name"
								bind:value={destination.newProgramName}
								oninput={() => (programError = undefined)}
							/>
							{#if programError}
								<p class="text-error px-0.5 pt-1 text-xs">{programError}</p>
							{/if}
						</div>
					{/if}
					<hr class="border-base-300 mx-3 my-1" />
					<button
						class={[
							'flex items-center gap-3 rounded-xl px-3 py-3 text-left',
							destination.type === 'routines' ? 'bg-base-200' : 'hover:bg-base-200'
						]}
						aria-pressed={destination.type === 'routines'}
						onclick={() => setDestination({ type: 'routines' })}
					>
						<span
							class={[
								'grid size-6 shrink-0 place-items-center rounded-full',
								destination.type === 'routines'
									? 'bg-primary text-primary-content'
									: 'border-base-300 border-2'
							]}
							>{#if destination.type === 'routines'}✓{/if}</span
						>
						<span class="flex-1 font-medium">Just my routines</span>
					</button>
				</div>
			</div>

			{#if destination.type === 'program'}
				{@const d = destination}
				<div class="flex flex-col gap-2">
					<div class="flex items-baseline justify-between">
						<p class="text-base-content/60 text-xs font-semibold tracking-widest uppercase">Days</p>
						<p class="text-base-content/50 text-xs">Pick every day it's on</p>
					</div>
					<div class="grid grid-cols-7 gap-1" role="group" aria-label="Days">
						{#each weekOrder([0, 1, 2, 3, 4, 5, 6], session.prefs.weekStart) as day (day)}
							{@const on = d.days.includes(day)}
							<button
								class={['btn btn-sm px-0', on && 'btn-primary']}
								aria-pressed={on}
								aria-label={DAY_FULL[day]}
								onclick={() => toggleDay(day)}>{DAY_NAMES[day]}</button
							>
						{/each}
					</div>
				</div>
				<div class="flex flex-col gap-2">
					<p class="text-base-content/60 text-xs font-semibold tracking-widest uppercase">
						Time of day
					</p>
					<div class="grid grid-cols-3 gap-1">
						{#each SLOTS as slot (slot)}
							<button
								class={['btn btn-sm', d.slot === slot && 'btn-primary']}
								aria-pressed={d.slot === slot}
								onclick={() => setSlot(slot)}>{SLOT_LABEL[slot]}</button
							>
						{/each}
						<button
							class={['btn btn-sm', !d.slot && 'btn-primary']}
							aria-pressed={!d.slot}
							onclick={() => setSlot(undefined)}>{ANYTIME}</button
						>
					</div>
					{#if slotNote}
						<p class="text-base-content/50 text-xs">{slotNote}</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
	{#snippet footer()}
		<button class="btn btn-primary btn-lg w-full" onclick={() => (showWhere = false)}>Done</button>
	{/snippet}
</BottomSheet>

<BottomSheet bind:open={editOpen} size="medium" title="Edit exercise">
	{#if editing}
		<div class="flex flex-col gap-3">
			<label class="flex flex-col gap-1.5">
				<span class="text-base-content/60 text-sm font-medium">Name</span>
				<input class="input input-bordered w-full" bind:value={editing.exercise.name} />
			</label>
			<div class="grid grid-cols-3 gap-2">
				<label class="flex flex-col gap-1.5">
					<span class="text-base-content/60 text-sm font-medium">Sets</span>
					<input
						class="input input-bordered w-full"
						type="number"
						inputmode="numeric"
						min="1"
						bind:value={editing.exercise.targetSets}
					/>
				</label>
				<label class="flex flex-col gap-1.5">
					<span class="text-base-content/60 text-sm font-medium">Min reps</span>
					<input
						class="input input-bordered w-full"
						type="number"
						inputmode="numeric"
						min="1"
						bind:value={editing.exercise.minReps}
					/>
				</label>
				<label class="flex flex-col gap-1.5">
					<span class="text-base-content/60 text-sm font-medium">Max reps</span>
					<input
						class="input input-bordered w-full"
						type="number"
						inputmode="numeric"
						min="1"
						bind:value={editing.exercise.maxReps}
					/>
				</label>
			</div>
		</div>
	{/if}
	{#snippet footer()}
		<div class="flex flex-col gap-1.5">
			<button
				class="btn btn-primary btn-lg"
				disabled={!editing?.exercise.name.trim()}
				onclick={saveEdit}>Done</button
			>
			<button class="btn btn-ghost text-error" onclick={removeRow}>Remove exercise</button>
		</div>
	{/snippet}
</BottomSheet>

<style>
	.scanline {
		animation: scan 1.6s ease-in-out infinite alternate;
	}
	@keyframes scan {
		from {
			top: 0;
		}
		to {
			top: calc(100% - 2px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.scanline {
			animation: none;
			top: 50%;
		}
	}
</style>
