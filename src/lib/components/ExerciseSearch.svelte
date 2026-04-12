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
	<div class="relative">
		<input
			type="search"
			{placeholder}
			class="input input-sm input-bordered search-input w-full pr-8"
			bind:value={searchValue}
		/>
		{#if searchValue}
			<button
				class="text-base-content/30 hover:text-base-content/60 absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors"
				onclick={() => (searchValue = '')}
				aria-label="Clear search"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-3.5 w-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
					><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg
				>
			</button>
		{/if}
	</div>

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
