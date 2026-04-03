<script lang="ts">
	import { scale } from 'svelte/transition';
	import AddIcon from '$lib/icons/add.svg?raw';
	import { restTimer } from '$lib/state.svelte';

	let { onclick, hidden = false }: { onclick: () => void; hidden?: boolean } = $props();

	// Move FAB up when rest timer is active to avoid blocking it
	let bottomPosition = $derived(
		restTimer.value
			? 'calc(4rem + env(safe-area-inset-bottom, 0px) + 5.75rem)'
			: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 0.75rem)'
	);
</script>

{#if !hidden}
	<button
		transition:scale={{ duration: 150, start: 0.8 }}
		class="btn btn-circle btn-lg btn-primary fixed z-70 shadow-xl transition-[bottom] duration-300 ease-out [&>svg]:h-6 [&>svg]:w-6"
		style="bottom: {bottomPosition}; right: 1rem;"
		{onclick}
		aria-label="Add"
	>
		{@html AddIcon}
	</button>
{/if}
