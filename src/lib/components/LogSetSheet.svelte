<script lang="ts">
	import { formatDistanceToNowStrict } from 'date-fns';
	import { session } from '$lib/session.svelte';
	import { exercises, library } from '$lib/data';
	import { loadCatalog, type Catalog } from '$lib/catalog';
	import { catalogExerciseFor, matchExercise, normalizeName } from '$lib/catalog/match';
	import { EQUIPMENT_LABELS, MUSCLE_LABELS, exerciseMatches } from '$lib/catalog/labels';
	import { planImport } from '$lib/catalog/plan';
	import { recordSet } from '$lib/logic/logSet';
	import { getNameValidationMsg } from '$lib/utils';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import SetAdjuster from '$lib/components/SetAdjuster.svelte';
	import Chevron from '$lib/components/Chevron.svelte';
	import type { Workout } from '$lib/types';

	/**
	 * One set of any exercise, from Today, without leaving it. Step one picks
	 * the exercise: recent ones, the whole library A–Z, and (when searching)
	 * Discover's exercises not in the library yet, which are added as the set
	 * is logged. Step two is the run screen's reps and weight, and Log.
	 */

	let { open = $bindable(false) }: { open?: boolean } = $props();

	type Choice =
		| { kind: 'library'; workoutId: string }
		| { kind: 'catalog'; catalogId: string; name: string };

	let search = $state('');
	let choice = $state<Choice | null>(null);
	let reps = $state(10);
	let weight = $state(0);
	let saving = $state(false);

	let catalog = $state<Catalog | null>(null);
	$effect(() => {
		if (!open || catalog) return;
		loadCatalog()
			.then((c) => (catalog = c))
			.catch(() => {});
	});

	// Closing starts the next one fresh.
	$effect(() => {
		if (open) return;
		search = '';
		choice = null;
		saving = false;
	});

	let unit = $derived(session.prefs.weightUnit === 'kg' ? 'kg' : 'lb');
	let workouts = $derived(session.workouts ?? []);
	let query = $derived(normalizeName(search));
	const hit = (name: string) => !query || normalizeName(name).includes(query);

	const lastDone = (w: Workout) =>
		w.sets.reduce((latest, s) => Math.max(latest, Date.parse(s.date)), 0);

	function lastLine(w: Workout): string {
		const last = w.sets.at(-1);
		if (!last) return 'Never done';
		const when = formatDistanceToNowStrict(Date.parse(last.date), {
			addSuffix: true,
			roundingMethod: 'floor'
		});
		return `${when} · last ${last.weight ? `${last.weight} ${unit} × ` : ''}${last.reps}`;
	}

	let recent = $derived(
		query
			? []
			: workouts
					.filter((w) => w.sets.length)
					.sort((a, b) => lastDone(b) - lastDone(a))
					.slice(0, 5)
	);
	let all = $derived(
		workouts.filter((w) => hit(w.name)).sort((a, b) => a.name.localeCompare(b.name))
	);
	/** Discover exercises the library doesn't already have for certain, while searching. */
	let fromDiscover = $derived(
		!query || !catalog
			? []
			: catalog.exercises.filter(
					(e) => matchExercise(e, workouts)?.confidence !== 'certain' && exerciseMatches(e, search)
				)
	);
	/** The typed name, when it matches nothing in the library or Discover. */
	let createName = $derived.by(() => {
		if (!query) return null;
		const taken =
			workouts.some((w) => normalizeName(w.name) === query) ||
			(catalog?.exercises ?? []).some((e) =>
				[e.name, ...(e.aliases ?? [])].some((n) => normalizeName(n) === query)
			);
		return taken ? null : search.trim();
	});

	// ── Step two ────────────────────────────────────────────────────────────────
	let chosenWorkout = $derived(
		choice?.kind === 'library' ? session.workout(choice.workoutId) : null
	);
	let chosenName = $derived(
		choice?.kind === 'catalog' ? choice.name : (chosenWorkout?.name ?? '')
	);
	let equipment = $derived.by(() => {
		if (!catalog || !choice) return undefined;
		if (choice.kind === 'catalog') return catalog.exercise(choice.catalogId)?.equipment;
		return chosenWorkout ? catalogExerciseFor(chosenWorkout, catalog.exercises)?.equipment : undefined;
	});
	let hasHistory = $derived((chosenWorkout?.sets.length ?? 0) > 0);
	// As on the run screen: a first set of a loaded exercise hasn't chosen a weight yet.
	let weightUnset = $derived(
		weight === 0 && !hasHistory && equipment !== undefined && equipment !== 'bodyweight'
	);

	function pick(next: Choice) {
		choice = next;
		const last = next.kind === 'library' ? session.workout(next.workoutId)?.sets.at(-1) : null;
		reps = last?.reps ?? 10;
		weight = last?.weight ?? 0;
	}

	async function create(name: string) {
		const message = getNameValidationMsg('Workout', name, session.workouts);
		if (message) return;
		saving = true;
		const workout = await exercises.create(name);
		saving = false;
		if (workout) pick({ kind: 'library', workoutId: workout.id });
	}

	async function log() {
		if (!choice || saving) return;
		let workoutId = choice.kind === 'library' ? choice.workoutId : null;
		if (choice.kind === 'catalog') {
			const bundle = catalog?.bundle('exercise', choice.catalogId);
			const lib = session.library;
			if (!bundle || !lib) return;
			// Chosen over any alias match on purpose, so it's added as its own exercise.
			const plan = planImport(bundle, lib, { aliasChoices: { [choice.catalogId]: 'new' } });
			saving = true;
			const ok = await library.add(plan);
			saving = false;
			if (!ok) return;
			workoutId = plan.root.id;
		}
		if (!workoutId) return;
		recordSet(workoutId, { reps, weight }, { message: `${chosenName} · set logged` });
		open = false;
	}

	let draftLabel = $derived(
		weight > 0 ? `${weight} ${unit} × ${reps}` : weightUnset ? `${reps} · no weight` : `${reps} reps`
	);
</script>

{#snippet row(name: string, meta: string, onclick: () => void, add = false)}
	<button
		type="button"
		class="hover:bg-base-300 flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors"
		{onclick}
	>
		<span class="flex min-w-0 flex-1 flex-col">
			<span class="truncate font-semibold">{name}</span>
			<span class="text-base-content/55 truncate text-xs">{meta}</span>
		</span>
		{#if add}
			<span
				class="bg-primary/15 text-primary-strong flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
				aria-hidden="true"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
					><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg
				>
			</span>
		{:else}
			<Chevron />
		{/if}
	</button>
{/snippet}

{#snippet group(label: string, rows: import('svelte').Snippet)}
	<section class="flex flex-col gap-2">
		<p class="text-base-content/55 text-xs font-semibold tracking-widest uppercase">{label}</p>
		<div class="bg-base-200 divide-base-300 flex flex-col divide-y overflow-hidden rounded-2xl">
			{@render rows()}
		</div>
	</section>
{/snippet}

<BottomSheet bind:open size="large" title={choice ? chosenName : 'Log a set'} fill={!choice}>
	{#snippet toolbar()}
		{#if choice}
			<div class="-mt-2 flex items-center gap-2">
				<button
					type="button"
					class="btn btn-ghost btn-sm -ml-2 gap-1 px-2"
					onclick={() => (choice = null)}
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
						><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg
					>
					All exercises
				</button>
				<span class="text-base-content/55 ml-auto truncate text-xs">
					{chosenWorkout?.sets.length ? `Last time: ${lastLine(chosenWorkout)}` : 'First set'}
				</span>
			</div>
		{:else}
			<label class="input bg-base-200 flex w-full items-center gap-2 border-none">
				<svg
					class="text-base-content/50 h-4 w-4 shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					aria-hidden="true"
					><path
						d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
						stroke-linecap="round"
					/></svg
				>
				<!-- Not a credential field, so iOS doesn't offer Passwords above the keyboard. -->
				<input
					id="log-set-search"
					name="exercise-search"
					type="search"
					autocomplete="off"
					autocapitalize="words"
					enterkeyhint="search"
					placeholder="Search exercises"
					aria-label="Search exercises"
					class="min-w-0 flex-1"
					bind:value={search}
				/>
			</label>
		{/if}
	{/snippet}

	{#if choice}
		<SetAdjuster bind:reps bind:weight {weightUnset} />
		<p class="text-base-content/50 mt-3 text-center text-xs">
			Starts your rest timer{choice.kind === 'catalog' ? ' · adds it to your library' : ''}
		</p>
	{:else}
		<div class="flex flex-col gap-5 pb-4">
			{#if recent.length}
				{#snippet recentRows()}
					{#each recent as w (w.id)}
						{@render row(w.name, lastLine(w), () => pick({ kind: 'library', workoutId: w.id }))}
					{/each}
				{/snippet}
				{@render group('Recent', recentRows)}
			{/if}

			{#if all.length}
				{#snippet allRows()}
					{#each all as w (w.id)}
						{@render row(w.name, lastLine(w), () => pick({ kind: 'library', workoutId: w.id }))}
					{/each}
				{/snippet}
				{@render group(query ? 'Your exercises' : 'All exercises', allRows)}
			{/if}

			{#if fromDiscover.length}
				{#snippet discoverRows()}
					{#each fromDiscover as e (e.id)}
						{@render row(
							e.name,
							`${EQUIPMENT_LABELS[e.equipment]} · ${MUSCLE_LABELS[e.muscles[0]]} · adds to your library`,
							() => pick({ kind: 'catalog', catalogId: e.id, name: e.name }),
							true
						)}
					{/each}
				{/snippet}
				{@render group('From Discover', discoverRows)}
			{/if}

			{#if query && !all.length && !fromDiscover.length && !createName}
				<p class="text-base-content/55 py-6 text-center text-sm">Nothing matches “{search.trim()}”.</p>
			{/if}

			{#if createName}
				<button
					type="button"
					class="btn btn-ghost text-primary-strong"
					disabled={saving}
					onclick={() => create(createName!)}>+ New exercise “{createName}”</button
				>
			{:else if !query && !workouts.length}
				<p class="text-base-content/55 py-6 text-center text-sm">
					No exercises yet. Search to find one in Discover, or type a name to create it.
				</p>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		{#if choice}
			<button
				type="button"
				class="btn btn-primary btn-lg h-14 w-full gap-2 rounded-2xl"
				disabled={saving}
				onclick={log}
			>
				<span class="font-bold">Log set</span>
				<span class="font-medium opacity-75">{draftLabel}</span>
			</button>
		{/if}
	{/snippet}
</BottomSheet>
