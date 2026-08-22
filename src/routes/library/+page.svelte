<script lang="ts">
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { LIBRARY_TABS, isLibraryTab, type LibraryTab } from '$lib/routes';
	import ExerciseList from './ExerciseList.svelte';
	import RoutineList from './RoutineList.svelte';
	import ProgramList from './ProgramList.svelte';

	// Exercises, routines and programs are three views of the same library, so
	// they share one tab and one URL rather than three top-level destinations.
	let tab = $derived<LibraryTab>(
		isLibraryTab(page.url.searchParams.get('tab'))
			? (page.url.searchParams.get('tab') as LibraryTab)
			: 'exercises'
	);

	function select(next: LibraryTab) {
		const url = new URL(page.url);
		url.searchParams.set('tab', next);
		// replaceState keeps the segment switch out of history, so Back still
		// leaves the Library rather than walking through the segments.
		replaceState(url, page.state);
	}
</script>

<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
	<div role="tablist" class="tabs tabs-box grid grid-cols-3">
		{#each LIBRARY_TABS as { id, label }}
			<button
				role="tab"
				class="tab"
				class:tab-active={tab === id}
				aria-selected={tab === id}
				onclick={() => select(id)}>{label}</button
			>
		{/each}
	</div>

	{#if tab === 'exercises'}
		<ExerciseList />
	{:else if tab === 'routines'}
		<RoutineList />
	{:else}
		<ProgramList />
	{/if}
</div>
