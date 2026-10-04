<script lang="ts">
	import { DISCOVER_TABS, discoverItemHref, isDiscoverTab } from '$lib/routes';
	import { urlTab } from '$lib/urlTab.svelte';
	import { session } from '$lib/session.svelte';
	import { isInLibrary, planImport, type CatalogKind } from '$lib/catalog';
	import {
		EQUIPMENT_LABELS,
		LEVEL_LABELS,
		MUSCLE_FILTERS,
		MUSCLE_LABELS,
		exerciseMatches,
		programMatches,
		routineMatches,
		trainingDays
	} from '$lib/catalog/labels';
	import SegmentedTabs from '$lib/components/SegmentedTabs.svelte';
	import Chevron from '$lib/components/Chevron.svelte';
	import WeekStrip from './WeekStrip.svelte';

	let { data } = $props();
	let catalog = $derived(data.catalog);

	// Routines first: they're the quickest route from an empty Library to a
	// workout, which is what most people come here for.
	const tab = urlTab(isDiscoverTab, 'routines');

	let search = $state('');
	let muscle = $state<string | null>(null);

	const PLACEHOLDERS = {
		exercises: 'Search exercises…',
		routines: 'Search routines or exercises…',
		programs: 'Search programs…'
	};

	let exercises = $derived.by(() => {
		const group = MUSCLE_FILTERS.find((f) => f.id === muscle);
		return catalog.exercises.filter(
			(e) => (!group || group.muscles.includes(e.muscles[0])) && exerciseMatches(e, search)
		);
	});
	let routines = $derived(catalog.routines.filter((r) => routineMatches(catalog, r, search)));
	let programs = $derived(catalog.programs.filter((p) => programMatches(catalog, p, search)));

	/** Catalog ids already in the user's library, per kind. Empty until it loads. */
	let added = $derived.by(() => {
		const library = session.library;
		const ids = new Set<string>();
		if (!library) return ids;
		const check = (kind: CatalogKind, id: string) => {
			const bundle = catalog.bundle(kind, id);
			if (bundle && isInLibrary(planImport(bundle, library))) ids.add(`${kind}:${id}`);
		};
		catalog.exercises.forEach((e) => check('exercise', e.id));
		catalog.routines.forEach((r) => check('routine', r.id));
		catalog.programs.forEach((p) => check('program', p.id));
		return ids;
	});
</script>

{#snippet addedBadge()}
	<span class="badge badge-success badge-xs shrink-0">In library</span>
{/snippet}

{#snippet noMatches()}
	<p class="text-base-content/50 pt-6 text-center text-sm">Nothing matches “{search.trim()}”.</p>
{/snippet}

<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
	<SegmentedTabs tabs={DISCOVER_TABS} current={tab.current} onSelect={tab.select} />

	<div class="relative">
		<input
			type="search"
			placeholder={PLACEHOLDERS[tab.current]}
			class="input input-bordered w-full pr-9"
			bind:value={search}
		/>
		{#if search}
			<button
				class="text-base-content/30 hover:text-base-content/60 absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors"
				onclick={() => (search = '')}
				aria-label="Clear search"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
					><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg
				>
			</button>
		{/if}
	</div>

	{#if tab.current === 'exercises'}
		<div
			class="-mx-1 flex scrollbar-none gap-1.5 overflow-x-auto px-1"
			role="group"
			aria-label="Muscle group"
		>
			{#each [{ id: null, label: 'All' }, ...MUSCLE_FILTERS] as filter (filter.id)}
				<button
					class="btn btn-xs shrink-0 rounded-full transition-all"
					class:btn-primary={muscle === filter.id}
					class:btn-ghost={muscle !== filter.id}
					class:opacity-50={muscle !== filter.id}
					aria-pressed={muscle === filter.id}
					onclick={() => (muscle = filter.id)}>{filter.label}</button
				>
			{/each}
		</div>

		{#if exercises.length}
			<ul class="flex flex-col gap-2 pb-4">
				{#each exercises as exercise (exercise.id)}
					<li>
						<a
							href={discoverItemHref('exercises', exercise.id)}
							class="bg-base-200 hover:bg-base-300 rounded-box flex items-center gap-3 px-4 py-3 transition-colors active:scale-[0.99]"
						>
							<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
								<div class="flex items-center gap-2">
									<span class="truncate text-sm font-semibold">{exercise.name}</span>
									{#if added.has(`exercise:${exercise.id}`)}{@render addedBadge()}{/if}
								</div>
								<span class="text-base-content/50 truncate text-xs">
									{exercise.muscles.map((m) => MUSCLE_LABELS[m]).join(', ')} · {EQUIPMENT_LABELS[
										exercise.equipment
									]}
								</span>
							</div>
							<Chevron />
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			{@render noMatches()}
		{/if}
	{:else if tab.current === 'routines'}
		{#if routines.length}
			<ul class="flex flex-col gap-2 pb-4">
				{#each routines as routine (routine.id)}
					<li>
						<a
							href={discoverItemHref('routines', routine.id)}
							class="bg-base-200 hover:bg-base-300 rounded-box flex items-center gap-3 px-4 py-3.5 transition-colors active:scale-[0.99]"
						>
							<div class="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
								<div class="flex items-center gap-2">
									<span class="truncate font-semibold">{routine.name}</span>
									{#if added.has(`routine:${routine.id}`)}{@render addedBadge()}{/if}
								</div>
								<p class="text-base-content/50 line-clamp-2 text-xs">{routine.description}</p>
								<div class="flex items-center gap-1.5">
									<span class="badge badge-ghost badge-sm"
										>{routine.exercises.length} exercises</span
									>
									<span class="badge badge-ghost badge-sm">{LEVEL_LABELS[routine.level]}</span>
								</div>
							</div>
							<Chevron />
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			{@render noMatches()}
		{/if}
	{:else if programs.length}
		<ul class="flex flex-col gap-2 pb-4">
			{#each programs as program (program.id)}
				{@const days = trainingDays(program)}
				<li>
					<a
						href={discoverItemHref('programs', program.id)}
						class="bg-base-200 hover:bg-base-300 rounded-box flex items-center gap-3 px-4 py-3.5 transition-colors active:scale-[0.99]"
					>
						<div class="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
							<div class="flex items-center gap-2">
								<span class="truncate font-semibold">{program.name}</span>
								{#if added.has(`program:${program.id}`)}{@render addedBadge()}{/if}
							</div>
							<p class="text-base-content/50 line-clamp-2 text-xs">{program.description}</p>
							<div class="flex items-center justify-between gap-2">
								<WeekStrip {days} />
								<span class="text-base-content/40 text-xs"
									>{days.length}×/week · {LEVEL_LABELS[program.level]}</span
								>
							</div>
						</div>
						<Chevron />
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		{@render noMatches()}
	{/if}
</div>
