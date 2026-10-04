<script lang="ts">
	import { discoverItemHref } from '$lib/routes';
	import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '$lib/catalog/labels';
	import type { Catalog, CatalogExercise } from '$lib/catalog';
	import Chevron from '$lib/components/Chevron.svelte';

	let { exercise, catalog }: { exercise: CatalogExercise; catalog: Catalog } = $props();

	let usedIn = $derived(
		catalog.routines.filter((r) => r.exercises.some((e) => e.exerciseId === exercise.id))
	);
</script>

<section class="flex flex-col gap-2">
	<h2 class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">How to</h2>
	<p class="text-sm leading-relaxed">{exercise.instructions}</p>
</section>

<section class="flex flex-col gap-2">
	<h2 class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">Works</h2>
	<div class="flex flex-wrap gap-1.5">
		{#each exercise.muscles as muscle, i}
			<span class="badge {i === 0 ? 'badge-primary badge-soft' : 'badge-ghost'}"
				>{MUSCLE_LABELS[muscle]}</span
			>
		{/each}
		<span class="badge badge-outline">{EQUIPMENT_LABELS[exercise.equipment]}</span>
	</div>
</section>

{#if exercise.aliases?.length}
	<section class="flex flex-col gap-1">
		<h2 class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">
			Also called
		</h2>
		<p class="text-base-content/70 text-sm">{exercise.aliases.join(' · ')}</p>
	</section>
{/if}

{#if usedIn.length}
	<section class="flex flex-col gap-2">
		<h2 class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">
			In these routines
		</h2>
		<ul class="flex flex-col gap-2">
			{#each usedIn as routine (routine.id)}
				<li>
					<a
						href={discoverItemHref('routines', routine.id)}
						class="bg-base-200 hover:bg-base-300 rounded-box flex items-center gap-3 px-4 py-3 transition-colors active:scale-[0.99]"
					>
						<span class="min-w-0 flex-1 truncate text-sm font-semibold">{routine.name}</span>
						<span class="text-base-content/40 text-xs">{routine.exercises.length} exercises</span>
						<Chevron />
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}
