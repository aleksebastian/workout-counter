<script lang="ts">
	import { DAY_FULL } from '$lib/constants';
	import { discoverItemHref } from '$lib/routes';
	import type { Catalog, CatalogProgram } from '$lib/catalog';
	import Chevron from '$lib/components/Chevron.svelte';

	let { program, catalog }: { program: CatalogProgram; catalog: Catalog } = $props();

	let days = $derived(
		program.schedule.filter((d) => d.items.length > 0).sort((a, b) => a.day - b.day)
	);
</script>

<section class="flex flex-col gap-3">
	<h2 class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">
		Weekly schedule
	</h2>
	{#each days as day (day.day)}
		<div class="flex flex-col gap-1.5">
			<p class="text-sm font-semibold">
				{DAY_FULL[day.day]}{#if day.label}<span class="text-base-content/50 font-normal">
						· {day.label}</span
					>{/if}
			</p>
			<ul class="flex flex-col gap-2">
				{#each day.items as item, i (i)}
					{#if item.type === 'routine'}
						{@const routine = catalog.routine(item.routineId)}
						{#if routine}
							<li>
								<a
									href={discoverItemHref('routines', routine.id)}
									class="bg-base-200 hover:bg-base-300 rounded-box flex items-center gap-3 px-4 py-3 transition-colors active:scale-[0.99]"
								>
									<span class="badge badge-primary badge-soft badge-xs shrink-0">Routine</span>
									<span class="min-w-0 flex-1 truncate text-sm font-semibold">{routine.name}</span>
									<span class="text-base-content/40 text-xs"
										>{routine.exercises.length} exercises</span
									>
									<Chevron />
								</a>
							</li>
						{/if}
					{:else}
						{@const exercise = catalog.exercise(item.exerciseId)}
						{#if exercise}
							<li>
								<a
									href={discoverItemHref('exercises', exercise.id)}
									class="bg-base-200 hover:bg-base-300 rounded-box flex items-center gap-3 px-4 py-3 transition-colors active:scale-[0.99]"
								>
									<span class="min-w-0 flex-1 truncate text-sm font-semibold">{exercise.name}</span>
									<span class="text-base-content/40 text-xs"
										>{item.targetSets} set{item.targetSets > 1 ? 's' : ''}</span
									>
									<Chevron />
								</a>
							</li>
						{/if}
					{/if}
				{/each}
			</ul>
		</div>
	{/each}
</section>
