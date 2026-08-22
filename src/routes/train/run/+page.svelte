<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import confetti from 'canvas-confetti';
	import { v4 as uuidv4 } from 'uuid';
	import { exercises } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { setPageNav } from '$lib/nav.svelte';
	import { restTimer } from '$lib/logic/restTimer.svelte';
	import { pwa } from '$lib/logic/pwa.svelte';
	import { HAPTIC } from '$lib/haptic';
	import { libraryHref } from '$lib/routes';
	import { itemsForDay } from '$lib/types';
	import SetEntry from '$lib/components/SetEntry.svelte';
	import NotesIcon from '$lib/icons/notes.svg?raw';

	/**
	 * One guided session flow, whether the plan came from a program day or a
	 * single routine. Both used to be different code paths — a program had this
	 * screen and a routine had "tap each exercise, go back, repeat".
	 */

	type PlanEntry = {
		workoutId: string;
		/** undefined = free-form: the user decides when to move on. */
		targetSets?: number;
		groupLabel?: string;
		groupProgress?: { current: number; total: number };
		routineId?: string;
	};

	let programId = $derived(page.url.searchParams.get('program'));
	let routineId = $derived(page.url.searchParams.get('routine'));

	let program = $derived(session.program(programId ?? undefined));
	let routine = $derived(session.routine(routineId ?? undefined));

	let day = $derived.by(() => {
		const raw = page.url.searchParams.get('day');
		const parsed = raw === null ? NaN : parseInt(raw, 10);
		return Number.isInteger(parsed) ? parsed : new Date().getDay();
	});

	let sourceName = $derived(program?.name ?? routine?.name ?? '');
	let backHref = $derived(
		program ? `/programs/${program.id}` : routine ? `/routines/${routine.id}` : '/train'
	);

	setPageNav(
		() => sourceName,
		() => backHref
	);

	let loading = $derived(session.programs === null || session.routines === null);
	let sourceMissing = $derived(!loading && !program && !routine);

	function expandRoutine(id: string, includeGroupLabel: boolean): PlanEntry[] {
		const r = session.routine(id);
		if (!r) return [];
		return r.exercises.map((ex, idx) => ({
			workoutId: ex.workoutId,
			targetSets: ex.targetSets,
			routineId: r.id,
			...(includeGroupLabel
				? {
						groupLabel: r.name,
						groupProgress: { current: idx + 1, total: r.exercises.length }
					}
				: {})
		}));
	}

	let planEntries = $derived.by((): PlanEntry[] => {
		if (session.workouts === null) return [];
		// A routine run is just the routine expanded; a program day may mix
		// routines and one-off exercises, so both funnel into the same shape.
		if (routine) return expandRoutine(routine.id, false);
		if (!program) return [];

		return itemsForDay(program, day).flatMap((item) =>
			item.type === 'exercise'
				? [{ workoutId: item.workoutId, targetSets: item.targetSets }]
				: expandRoutine(item.routineId, true)
		);
	});

	const todayStr = new Date().toDateString();
	function setsToday(workoutId: string): number {
		return (
			session.workout(workoutId)?.sets.filter((s) => new Date(s.date).toDateString() === todayStr)
				.length ?? 0
		);
	}

	// ── Position ────────────────────────────────────────────────────────────────
	// A single explicit index. It only ever moves because the user advanced, so
	// the screen never jumps out from under someone mid-set.
	let currentIndex = $state(0);
	let finished = $state(false);
	let seeded = false;

	$effect(() => {
		if (seeded || planEntries.length === 0) return;
		seeded = true;
		// Resume where the user left off if some of today's work is already done.
		const firstIncomplete = planEntries.findIndex(
			(entry) => entry.targetSets === undefined || setsToday(entry.workoutId) < entry.targetSets
		);
		currentIndex = firstIncomplete === -1 ? 0 : firstIncomplete;
	});

	let currentEntry = $derived(planEntries[currentIndex] ?? null);
	let currentWorkout = $derived(session.workout(currentEntry?.workoutId));
	let isFreeForm = $derived(currentEntry?.targetSets === undefined);
	let targetSets = $derived(currentEntry?.targetSets ?? 0);
	let setsDone = $derived(currentEntry ? setsToday(currentEntry.workoutId) : 0);
	let hitTarget = $derived(!!currentEntry && !isFreeForm && setsDone >= targetSets);
	/** Set when the user chooses to keep going past the target on this exercise. */
	let recordingExtra = $state(false);
	let exerciseComplete = $derived(hitTarget && !recordingExtra);
	let isLastEntry = $derived(currentIndex >= planEntries.length - 1);
	let nextEntry = $derived(planEntries[currentIndex + 1] ?? null);

	// ── Set entry ───────────────────────────────────────────────────────────────
	let reps = $state(10);
	let weight = $state(0);
	let notes = $state('');
	let showNotes = $state(false);

	// Seed from the last recorded set whenever the exercise changes.
	let seededFor = $state<string | null>(null);
	$effect(() => {
		const id = currentWorkout?.id;
		if (!id || seededFor === id) return;
		seededFor = id;
		recordingExtra = false;
		const last = currentWorkout!.sets.at(-1);
		reps = last?.reps ?? 10;
		weight = last?.weight ?? 0;
		notes = '';
		showNotes = false;
	});

	// ── Elapsed ─────────────────────────────────────────────────────────────────
	const startedAt = Date.now();
	let now = $state(Date.now());
	let finalDuration = $state<string | null>(null);

	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});

	let elapsedLabel = $derived.by(() => {
		const s = Math.floor((now - startedAt) / 1000);
		return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
	});

	function formatDuration(ms: number): string {
		const total = Math.floor(ms / 1000);
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		const s = total % 60;
		if (h > 0) return `${h}h ${m}m`;
		if (m > 0) return `${m}m ${s}s`;
		return `${s}s`;
	}

	// ── Summary ─────────────────────────────────────────────────────────────────
	let sessionTotals = $derived.by(() => {
		let sets = 0;
		let reps = 0;
		for (const entry of planEntries) {
			const todays =
				session
					.workout(entry.workoutId)
					?.sets.filter((s) => new Date(s.date).toDateString() === todayStr) ?? [];
			sets += todays.length;
			reps += todays.reduce((sum, s) => sum + s.reps, 0);
		}
		return { sets, reps };
	});

	// ── Actions ─────────────────────────────────────────────────────────────────
	async function recordSet() {
		if (!currentWorkout || !currentEntry) return;

		const set = {
			id: uuidv4(),
			reps,
			date: new Date().toISOString(),
			...(weight > 0 ? { weight } : {}),
			...(notes.trim() ? { notes: notes.trim() } : {})
		};

		HAPTIC.medium();
		// Routine timer beats the global default — resolved inside restTimer.
		restTimer.start({ routineId: currentEntry.routineId, workoutId: currentEntry.workoutId });
		pwa.noteSetRecorded();

		const ok = await exercises.addSet(currentWorkout.id, set);
		if (ok) {
			notes = '';
			showNotes = false;
		}
	}

	function advance() {
		HAPTIC.medium();
		if (isLastEntry) {
			finish();
		} else {
			currentIndex += 1;
		}
	}

	function finish() {
		finished = true;
		finalDuration = formatDuration(Date.now() - startedAt);
		HAPTIC.success();
		restTimer.stop();
		confetti({
			particleCount: 60,
			spread: 70,
			origin: { y: 0.5 },
			scalar: 0.9,
			colors: ['#a855f7', '#3b82f6', '#10b981']
		});
	}
</script>

{#if loading}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<div class="skeleton h-8 w-full rounded-xl"></div>
		<div class="skeleton h-64 w-full rounded-2xl"></div>
		<div class="skeleton h-14 w-full rounded-2xl"></div>
	</div>
{:else if sourceMissing}
	<div class="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
		<p class="font-semibold">That workout isn't available</p>
		<p class="text-base-content/50 text-sm">It may have been deleted on another device.</p>
		<a class="btn btn-primary btn-sm" href="/train">Back to Train</a>
	</div>
{:else if planEntries.length === 0}
	<div class="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
		<p class="font-semibold">Nothing scheduled here yet</p>
		<p class="text-base-content/50 max-w-xs text-sm">
			Add exercises to {sourceName} and it'll be ready to run.
		</p>
		<a class="btn btn-primary btn-sm" href={backHref}>Set it up</a>
	</div>
{:else if finished}
	<div class="mx-auto flex w-full max-w-lg flex-col items-center gap-6 py-8 text-center">
		<div class="bg-success/10 flex h-28 w-28 items-center justify-center rounded-full">
			<svg class="text-success h-12 w-12" viewBox="0 0 36 36" aria-hidden="true">
				<path
					fill="currentColor"
					d="M34.459 1.375a2.999 2.999 0 0 0-4.149.884L13.5 28.17l-8.198-7.58a2.999 2.999 0 1 0-4.073 4.405l10.764 9.952s.309.266.452.359a2.999 2.999 0 0 0 4.15-.884L35.343 5.524a2.999 2.999 0 0 0-.884-4.149z"
				/>
			</svg>
		</div>
		<div>
			<h1 class="text-2xl font-black">Workout complete!</h1>
			<p class="text-base-content/50 mt-1 text-sm">{sourceName}</p>
		</div>

		<div class="bg-base-200 divide-base-300 grid w-full grid-cols-3 divide-x rounded-2xl">
			<div class="flex flex-col items-center gap-0.5 px-4 py-4">
				<span class="text-2xl font-black tabular-nums">{planEntries.length}</span>
				<span class="text-base-content/50 text-xs">exercises</span>
			</div>
			<div class="flex flex-col items-center gap-0.5 px-4 py-4">
				<span class="text-2xl font-black tabular-nums">{sessionTotals.sets}</span>
				<span class="text-base-content/50 text-xs">sets</span>
			</div>
			<div class="flex flex-col items-center gap-0.5 px-4 py-4">
				<span class="text-2xl font-black tabular-nums">{sessionTotals.reps}</span>
				<span class="text-base-content/50 text-xs">reps</span>
			</div>
		</div>

		<p class="text-base-content/40 text-sm">Duration: {finalDuration ?? elapsedLabel}</p>

		<button class="btn btn-primary btn-lg w-full" onclick={() => goto('/train')}>Done</button>
	</div>
{:else}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<!-- Progress -->
		<div class="flex flex-col gap-1.5">
			<div class="bg-base-300 h-1.5 w-full overflow-hidden rounded-full">
				<div
					class="bg-primary h-full rounded-full transition-all duration-500"
					style:width="{Math.round((currentIndex / planEntries.length) * 100)}%"
				></div>
			</div>
			<p class="text-base-content/40 text-xs">
				Exercise {currentIndex + 1} of {planEntries.length} · {elapsedLabel}
			</p>
		</div>

		<!-- Current exercise -->
		<div class="flex flex-col gap-2">
			{#if currentEntry?.groupLabel}
				<div class="flex items-center gap-2">
					<span class="bg-primary/15 text-primary rounded px-2 py-0.5 text-xs font-semibold"
						>{currentEntry.groupLabel}</span
					>
					{#if currentEntry.groupProgress}
						<span class="text-base-content/40 text-xs">
							{currentEntry.groupProgress.current}/{currentEntry.groupProgress.total}
						</span>
					{/if}
				</div>
			{/if}
			<h1 class="text-2xl leading-tight font-black">{currentWorkout?.name ?? '—'}</h1>
			<div class="flex items-center gap-2">
				{#if isFreeForm}
					<span class="text-base-content/50 text-sm">{setsDone} sets today</span>
				{:else}
					<div class="flex gap-1">
						{#each { length: targetSets } as _, i}
							<span
								class="h-2.5 w-2.5 rounded-full transition-colors duration-200"
								class:bg-primary={i < setsDone}
								class:bg-base-300={i >= setsDone}
							></span>
						{/each}
					</div>
					<span class="text-base-content/50 text-sm">{setsDone}/{targetSets} sets</span>
				{/if}
			</div>
		</div>

		{#if exerciseComplete}
			<div class="bg-success/10 flex flex-col items-center gap-3 rounded-2xl px-6 py-8 text-center">
				<div class="text-success text-4xl">✓</div>
				<div>
					<p class="text-success font-semibold">Exercise complete!</p>
					<p class="text-base-content/50 mt-1 text-sm">{setsDone} sets done</p>
				</div>
			</div>

			{#if nextEntry}
				<div class="flex flex-col gap-2">
					<p class="text-base-content/40 text-center text-xs">Up next</p>
					<div class="bg-base-200 rounded-box px-4 py-3">
						{#if nextEntry.groupLabel}
							<span
								class="bg-primary/15 text-primary mr-2 rounded px-1.5 py-0.5 text-xs font-semibold"
								>{nextEntry.groupLabel}</span
							>
						{/if}
						<p class="font-semibold">{session.workout(nextEntry.workoutId)?.name ?? '—'}</p>
						<p class="text-base-content/40 text-xs">
							{nextEntry.targetSets !== undefined ? `${nextEntry.targetSets} sets` : 'Free-form'}
						</p>
					</div>
				</div>
			{/if}

			<button class="btn btn-primary btn-lg w-full" onclick={advance}>
				{isLastEntry ? 'Finish Workout →' : 'Next Exercise →'}
			</button>
			<!-- Escape hatch: extra sets beyond target are still allowed. -->
			<button class="btn btn-ghost btn-sm w-full" onclick={() => (recordingExtra = true)}>
				Record another set
			</button>
		{:else}
			<div class="card bg-base-200 w-full">
				<div class="card-body p-5">
					<SetEntry bind:reps bind:weight size="lg" fadeClass="from-base-200" />

					{#if showNotes}
						<input
							type="text"
							class="input input-bordered mt-4 w-full"
							placeholder="e.g. felt heavy, form off, easy…"
							aria-label="Set notes"
							bind:value={notes}
						/>
					{/if}
				</div>
			</div>

			<div class="flex gap-2">
				<button class="btn btn-primary btn-lg flex-1" onclick={recordSet}>Record Set</button>
				<button
					class="btn btn-lg btn-square"
					class:btn-primary={!!notes}
					class:btn-ghost={!notes}
					aria-label={showNotes ? 'Hide note' : 'Add a note'}
					onclick={() => (showNotes = !showNotes)}
				>
					<span class="[&>svg]:h-5 [&>svg]:w-5">{@html NotesIcon}</span>
				</button>
			</div>

			{#if isFreeForm}
				<button class="btn btn-outline btn-primary btn-lg w-full" onclick={advance}>
					{isLastEntry ? 'Finish Workout →' : 'Next Exercise →'}
				</button>
			{:else}
				<button class="btn btn-ghost btn-sm w-full" onclick={advance}>
					{isLastEntry ? 'Finish early' : 'Skip to next exercise'}
				</button>
			{/if}
		{/if}

		<a class="text-base-content/30 mt-2 text-center text-xs" href={libraryHref('exercises')}
			>Manage exercises</a
		>
	</div>
{/if}
