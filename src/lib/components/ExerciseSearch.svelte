<script lang="ts">
	import type { Workout } from '$lib/state.svelte';

	interface Props {
		exercises: Workout[];
		searchValue?: string;
		placeholder?: string;
		onSelect: (workoutId: string) => void;
		showCreateNew?: boolean;
		onCreateNew?: () => void;
	}

	let {
		exercises,
		searchValue = $bindable(''),
		placeholder = 'Search exercises…',
		onSelect,
		showCreateNew = false,
		onCreateNew
	}: Props = $props();

	let filteredExercises = $derived(
		searchValue.trim()
			? exercises.filter((w) => w.name.toLowerCase().includes(searchValue.toLowerCase()))
			: exercises
	);
</script>

<div class="flex flex-col gap-3">
	<!-- Search input -->
	<input
		type="search"
		{placeholder}
		class="input input-sm input-bordered search-input w-full"
		bind:value={searchValue}
	/>

	<!-- Exercise chips -->
	{#if exercises.length}
		<div class="flex flex-wrap gap-2">
			{#each filteredExercises as workout (workout.id)}
				<button class="btn btn-sm btn-ghost chip-button gap-1" onclick={() => onSelect(workout.id)}>
					<span class="text-base leading-none">+</span>{workout.name}
				</button>
			{/each}
			{#if filteredExercises.length === 0}
				<p class="text-base-content/40 fade-in-fast py-2 text-sm">No matches.</p>
			{/if}
		</div>
	{:else}
		<p class="text-base-content/40 text-sm">All exercises are already in this routine.</p>
	{/if}

	<!-- Create new exercise button -->
	{#if showCreateNew}
		<button class="btn btn-outline btn-sm gap-2 self-start" onclick={onCreateNew}>
			<span class="text-primary text-lg leading-none">+</span>
			<span class="text-primary">New exercise</span>
		</button>
	{/if}
</div>
