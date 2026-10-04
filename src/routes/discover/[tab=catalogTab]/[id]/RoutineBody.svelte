<script lang="ts">
	import { discoverItemHref } from '$lib/routes';
	import type { Catalog, CatalogRoutine, ImportPlan } from '$lib/catalog';
	import Chevron from '$lib/components/Chevron.svelte';

	let {
		routine,
		catalog,
		plan
	}: { routine: CatalogRoutine; catalog: Catalog; plan: ImportPlan | null } = $props();

	/** Exercises the user already has (certain matches only — alias ones are asked about above). */
	let owned = $derived(
		new Set(
			(plan?.exercises ?? [])
				.filter((e) => e.action === 'reuse' && e.match?.confidence === 'certain')
				.map((e) => e.exercise.id)
		)
	);
</script>

<section class="flex flex-col gap-2">
	<h2 class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">Exercises</h2>
	<ol class="flex flex-col gap-2">
		{#each routine.exercises as entry, i (entry.exerciseId)}
			{@const exercise = catalog.exercise(entry.exerciseId)}
			{#if exercise}
				<li>
					<a
						href={discoverItemHref('exercises', exercise.id)}
						class="bg-base-200 hover:bg-base-300 rounded-box flex items-center gap-3 px-4 py-3 transition-colors active:scale-[0.99]"
					>
						<span class="text-base-content/40 w-5 shrink-0 text-right text-xs font-medium"
							>{i + 1}</span
						>
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<span class="truncate text-sm font-semibold">{exercise.name}</span>
							<div class="flex flex-wrap items-center gap-1.5">
								{#if entry.targetSets}
									<span class="badge badge-sm badge-outline font-medium"
										>{entry.targetSets} set{entry.targetSets > 1 ? 's' : ''}</span
									>
								{/if}
								{#if entry.minReps || entry.maxReps}
									<span class="badge badge-sm badge-outline font-medium"
										>{entry.minReps ?? '?'}–{entry.maxReps ?? '?'} reps</span
									>
								{/if}
								{#if owned.has(exercise.id)}
									<span class="text-success text-xs font-medium">In your library</span>
								{/if}
							</div>
						</div>
						<Chevron />
					</a>
				</li>
			{/if}
		{/each}
	</ol>
</section>
