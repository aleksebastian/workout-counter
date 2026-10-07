<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import { v4 as uuidv4 } from 'uuid';
	import { exercises } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { setPageNav } from '$lib/nav.svelte';
	import { restTimer } from '$lib/logic/restTimer.svelte';
	import { training, type SessionSummary } from '$lib/logic/training.svelte';
	import { sameSource, setsSince, sourceFromParams } from '$lib/logic/training';
	import { pwa } from '$lib/logic/pwa.svelte';
	import { HAPTIC } from '$lib/haptic';
	import { libraryHref } from '$lib/routes';
	import SetEntry from '$lib/components/SetEntry.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import NotesIcon from '$lib/icons/notes.svg?raw';

	/**
	 * One guided session flow, whether the plan came from a program day or a
	 * single routine.
	 *
	 * The workout in progress is `training.session`, stored on the user
	 * document, so this screen can be left and reopened — even after the app
	 * restarts — and pick up exactly where it was. Start buttons link here with
	 * `?routine=` or `?program=&day=`; that request becomes the session (or a
	 * choice, if a different one is running) and is then dropped from the URL,
	 * so a reload resumes rather than restarting.
	 */

	const requested = sourceFromParams(page.url.searchParams, new Date().getDay());

	let ready = $derived(session.ready && session.library !== null);
	let active = $derived(training.session);
	/** The done screen, kept locally: the session itself is gone once finished. */
	let summary = $state<SessionSummary | null>(null);
	/** A Start link for a different workout arrived while one was in progress. */
	let conflict = $state(false);
	/** Whether this screen has seen its session, so its disappearing means it ended. */
	let seenActive = false;

	function dropRequest() {
		goto('/train/run', { replaceState: true, noScroll: true, keepFocus: true });
	}

	let handled = false;
	$effect(() => {
		if (!ready || handled) return;
		handled = true;
		if (!requested) return;
		if (!active) {
			training.start(requested);
			dropRequest();
		} else if (sameSource(active.source, requested)) {
			dropRequest();
		} else {
			conflict = true;
		}
	});

	// Nothing in progress — never asked for, or it ended elsewhere (another
	// device, or closed after inactivity): there's nothing to show here. A
	// request alone doesn't count until its session has appeared, since starting
	// one takes a moment to show up in the store.
	$effect(() => {
		if (active) seenActive = true;
		if (ready && !active && !summary && (!requested || seenActive)) {
			goto('/train', { replaceState: true });
		}
	});

	function resumeCurrent() {
		conflict = false;
		dropRequest();
	}

	function replaceCurrent() {
		if (!requested) return;
		// The old session disappears a beat before the new one appears; don't
		// read that gap as "ended elsewhere".
		seenActive = false;
		training.finish();
		training.start(requested);
		conflict = false;
		dropRequest();
	}

	let sourceName = $derived(summary?.name ?? training.name);
	let backHref = $derived(
		active?.source.type === 'program'
			? `/programs/${active.source.programId}`
			: active?.source.type === 'routine'
				? `/routines/${active.source.routineId}`
				: '/train'
	);

	setPageNav(
		() => sourceName,
		() => backHref
	);

	// ── Plan and position ───────────────────────────────────────────────────────
	/** `null` when the routine or program behind the session was deleted. */
	let planEntries = $derived(training.plan);
	let entries = $derived(planEntries ?? []);
	let startedAt = $derived(active?.startedAt ?? 0);

	/** This session's sets for an exercise — not "today's", see `setsSince`. */
	function setsDoneFor(workoutId: string): number {
		return setsSince(session.workout(workoutId), startedAt).length;
	}

	// Saved on the session, so it only moves when the user advances and
	// survives leaving the screen.
	let currentIndex = $derived(training.index);
	let currentEntry = $derived(entries[currentIndex] ?? null);
	let currentWorkout = $derived(session.workout(currentEntry?.workoutId));
	let isFreeForm = $derived(currentEntry?.targetSets === undefined);
	let targetSets = $derived(currentEntry?.targetSets ?? 0);
	let setsDone = $derived(currentEntry ? setsDoneFor(currentEntry.workoutId) : 0);
	let hitTarget = $derived(!!currentEntry && !isFreeForm && setsDone >= targetSets);
	/** Set when the user chooses to keep going past the target on this exercise. */
	let recordingExtra = $state(false);
	let exerciseComplete = $derived(hitTarget && !recordingExtra);
	let isLastEntry = $derived(currentIndex >= entries.length - 1);
	let nextEntry = $derived(entries[currentIndex + 1] ?? null);

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
	let now = $state(Date.now());

	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});

	let elapsedLabel = $derived.by(() => {
		const s = Math.max(0, Math.floor((now - startedAt) / 1000));
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = (s % 60).toString().padStart(2, '0');
		return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${sec}` : `${m}:${sec}`;
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
		// Routine timer beats the global default — resolved inside restTimer. A
		// program-day exercise outside any routine gets the global timer.
		pwa.noteSetRecorded(restTimer.start({ routineId: currentEntry.routineId }));

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
			training.moveTo(currentIndex + 1);
		}
	}

	function finish() {
		summary = training.finish();
		HAPTIC.success();
	}

	let endDialog = $state<HTMLDialogElement>()!;
</script>

{#snippet endButton()}
	<button class="btn btn-ghost btn-sm text-base-content/50" onclick={() => endDialog?.showModal()}
		>End workout</button
	>
{/snippet}

{#if conflict && active}
	<div class="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
		<div>
			<p class="font-semibold">{training.name || 'A workout'} is in progress</p>
			<p class="text-base-content/50 mt-1 text-sm">
				Started {formatDistanceToNow(active.startedAt, { addSuffix: true })}
			</p>
		</div>
		<div class="flex w-full max-w-xs flex-col gap-2">
			<button class="btn btn-primary" onclick={resumeCurrent}
				>Resume {training.name || 'workout'}</button
			>
			<button class="btn btn-ghost" onclick={replaceCurrent}>End it and start this one</button>
		</div>
	</div>
{:else if summary}
	<div class="mx-auto flex w-full max-w-lg flex-col items-center gap-6 py-8 text-center">
		{#if summary.complete}
			<div class="bg-success/10 flex h-28 w-28 items-center justify-center rounded-full">
				<svg class="text-success h-12 w-12" viewBox="0 0 36 36" aria-hidden="true">
					<path
						fill="currentColor"
						d="M34.459 1.375a2.999 2.999 0 0 0-4.149.884L13.5 28.17l-8.198-7.58a2.999 2.999 0 1 0-4.073 4.405l10.764 9.952s.309.266.452.359a2.999 2.999 0 0 0 4.15-.884L35.343 5.524a2.999 2.999 0 0 0-.884-4.149z"
					/>
				</svg>
			</div>
		{/if}
		<div>
			<!-- Only a workout that hit every target is "complete"; ending early is
			     reported plainly rather than celebrated. -->
			<h1 class="text-2xl font-black">
				{summary.complete ? 'Workout complete' : 'Workout ended'}
			</h1>
			<p class="text-base-content/50 mt-1 text-sm">{summary.name}</p>
		</div>

		<div class="bg-base-200 divide-base-300 grid w-full grid-cols-3 divide-x rounded-2xl">
			<div class="flex flex-col items-center gap-0.5 px-4 py-4">
				<span class="text-2xl font-black tabular-nums">{summary.exercises}</span>
				<span class="text-base-content/50 text-xs">exercises</span>
			</div>
			<div class="flex flex-col items-center gap-0.5 px-4 py-4">
				<span class="text-2xl font-black tabular-nums">{summary.sets}</span>
				<span class="text-base-content/50 text-xs">sets</span>
			</div>
			<div class="flex flex-col items-center gap-0.5 px-4 py-4">
				<span class="text-2xl font-black tabular-nums">{summary.reps}</span>
				<span class="text-base-content/50 text-xs">reps</span>
			</div>
		</div>

		<p class="text-base-content/40 text-sm">Duration: {formatDuration(summary.durationMs)}</p>

		<button class="btn btn-primary btn-lg w-full" onclick={() => goto('/train')}>Done</button>
	</div>
{:else if !ready || !active}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<div class="skeleton h-8 w-full rounded-xl"></div>
		<div class="skeleton h-64 w-full rounded-2xl"></div>
		<div class="skeleton h-14 w-full rounded-2xl"></div>
	</div>
{:else if planEntries === null}
	<div class="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
		<p class="font-semibold">That workout isn't available</p>
		<p class="text-base-content/50 text-sm">It may have been deleted on another device.</p>
		<button class="btn btn-primary btn-sm" onclick={finish}>End workout</button>
	</div>
{:else if entries.length === 0}
	<div class="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
		<p class="font-semibold">Nothing scheduled here yet</p>
		<p class="text-base-content/50 max-w-xs text-sm">
			Add exercises to {sourceName} and it'll be ready to run.
		</p>
		<a class="btn btn-primary btn-sm" href={backHref}>Set it up</a>
		{@render endButton()}
	</div>
{:else}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<!-- Progress -->
		<div class="flex flex-col gap-1.5">
			<div class="bg-base-300 h-1.5 w-full overflow-hidden rounded-full">
				<div
					class="bg-primary h-full rounded-full transition-all duration-500"
					style:width="{Math.round((currentIndex / entries.length) * 100)}%"
				></div>
			</div>
			<p class="text-base-content/40 text-xs">
				Exercise {currentIndex + 1} of {entries.length} · {elapsedLabel}
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

		<div class="mt-2 flex items-center justify-center gap-2">
			{@render endButton()}
			<a class="btn btn-ghost btn-sm text-base-content/30" href={libraryHref('exercises')}
				>Manage exercises</a
			>
		</div>
	</div>
{/if}

<ConfirmationDialog
	bind:dialog={endDialog}
	header="End this workout?"
	content="Your sets are saved, and it's added to your history."
	actionLabel="End workout"
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default') finish();
	}}
/>
