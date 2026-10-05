<script lang="ts">
	import { LIBRARY_TABS, isLibraryTab } from '$lib/routes';
	import { urlTab } from '$lib/urlTab.svelte';
	import SegmentedTabs from '$lib/components/SegmentedTabs.svelte';
	import ExerciseList from './ExerciseList.svelte';
	import RoutineList from './RoutineList.svelte';
	import ProgramList from './ProgramList.svelte';

	// Exercises, routines and programs are three views of the same library, so
	// they share one tab and one URL rather than three top-level destinations.
	const tab = urlTab(isLibraryTab, 'exercises');
</script>

<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
	<SegmentedTabs tabs={LIBRARY_TABS} current={tab.current} onSelect={tab.select} />

	{#if tab.current === 'exercises'}
		<ExerciseList />
	{:else if tab.current === 'routines'}
		<RoutineList />
	{:else}
		<ProgramList />
	{/if}
</div>
