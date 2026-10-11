<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { loadCatalog, type Catalog } from '$lib/catalog';
	import { catalogExerciseFor } from '$lib/catalog/match';
	import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '$lib/catalog/labels';
	import type { Workout } from '$lib/types';

	/**
	 * How to do the exercise on screen: the Discover catalog's instructions
	 * when it's one of those, and a video search for any exercise.
	 */

	interface Props {
		open?: boolean;
		workout: Workout | null;
	}

	let { open = $bindable(false), workout }: Props = $props();

	let catalog = $state<Catalog | null>(null);
	let failed = $state(false);

	// Loaded on first open: the catalog is its own chunk, kept off this screen's load.
	$effect(() => {
		if (!open || catalog) return;
		failed = false;
		loadCatalog()
			.then((c) => (catalog = c))
			.catch(() => (failed = true));
	});

	let guide = $derived(catalog && workout ? catalogExerciseFor(workout, catalog.exercises) : null);
	let videoHref = $derived(
		`https://www.youtube.com/results?search_query=${encodeURIComponent(`${workout?.name ?? ''} form`)}`
	);
</script>

<BottomSheet bind:open size="large" title={workout?.name ?? 'How to'}>
	<div class="flex flex-col gap-5">
		{#if !catalog && !failed}
			<div class="flex flex-col gap-2" aria-hidden="true">
				<div class="skeleton h-4 w-full rounded"></div>
				<div class="skeleton h-4 w-full rounded"></div>
				<div class="skeleton h-4 w-2/3 rounded"></div>
			</div>
		{:else if guide}
			<section class="flex flex-col gap-2">
				<h2 class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">How to</h2>
				<p class="text-sm leading-relaxed">{guide.instructions}</p>
			</section>
			<section class="flex flex-col gap-2">
				<h2 class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">Works</h2>
				<div class="flex flex-wrap gap-1.5">
					{#each guide.muscles as muscle, i (i)}
						<span class="badge {i === 0 ? 'badge-primary badge-soft' : 'badge-ghost'}"
							>{MUSCLE_LABELS[muscle]}</span
						>
					{/each}
					<span class="badge badge-outline">{EQUIPMENT_LABELS[guide.equipment]}</span>
				</div>
			</section>
		{:else if failed}
			<p class="text-base-content/60 text-sm">Couldn't load the exercise guide.</p>
		{:else}
			<p class="text-base-content/60 text-sm">
				There's no written guide for this exercise. A video of the movement is the next best thing.
			</p>
		{/if}

		<a
			class="btn bg-base-200 w-full gap-2 border-none"
			href={videoHref}
			target="_blank"
			rel="noopener noreferrer"
		>
			Watch a demo
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2.25"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
				/>
			</svg>
		</a>
	</div>
</BottomSheet>
