<script lang="ts">
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { LIBRARY_TABS, isLibraryTab, type LibraryTab } from '$lib/routes';
	import ExerciseList from './ExerciseList.svelte';
	import RoutineList from './RoutineList.svelte';
	import ProgramList from './ProgramList.svelte';

	// Exercises, routines and programs are three views of the same library, so
	// they share one tab and one URL rather than three top-level destinations.
	//
	// The selected segment is local state, not a derivation of `page.url`:
	// shallow routing updates the address bar and `page.state` but deliberately
	// leaves `page.url` pinned to the route's own URL, so deriving from it meant
	// the tab could never change.
	function tabFromUrl(): LibraryTab {
		const value = page.url.searchParams.get('tab');
		return isLibraryTab(value) ? value : 'exercises';
	}

	let tab = $state<LibraryTab>(tabFromUrl());

	// Re-seed only on a real navigation into the Library with an explicit tab —
	// an old /routines link, a bookmark, or a redirect.
	//
	// The href guard matters: replaceState re-publishes a cloned page object, so
	// without it this effect would re-run after every click and reset the tab
	// from the stale URL, which is the original bug wearing a different hat.
	let seededFrom = '';
	$effect(() => {
		const href = page.url.href;
		if (href === seededFrom) return;
		seededFrom = href;
		const value = page.url.searchParams.get('tab');
		if (isLibraryTab(value)) tab = value;
	});

	function select(next: LibraryTab) {
		tab = next;
		// Mirror the choice into the address bar so a reload or a shared link
		// reopens the same segment. replaceState keeps it out of history, so Back
		// still leaves the Library rather than walking back through the segments.
		const url = new URL(page.url);
		url.searchParams.set('tab', next);
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
