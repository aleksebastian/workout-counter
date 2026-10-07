<script lang="ts">
	import { scale } from 'svelte/transition';
	import AddIcon from '$lib/icons/add.svg?raw';
	import { bottomSlot } from '$lib/logic/bottomSlot.svelte';

	let {
		onclick,
		hidden = false,
		label = 'Add'
	}: { onclick: () => void; hidden?: boolean; label?: string } = $props();

	// Move the FAB up while the slot above the nav is taken, so it never covers a bar
	let bottomPosition = $derived(
		bottomSlot.occupied
			? 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 5.75rem)'
			: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 0.75rem)'
	);
</script>

{#if !hidden}
	<button
		transition:scale={{ duration: 150, start: 0.8 }}
		class="btn btn-circle btn-lg btn-primary fixed z-[550] shadow-xl transition-[bottom] duration-300 ease-out [&>svg]:h-6 [&>svg]:w-6"
		style="bottom: {bottomPosition}; right: 1rem;"
		{onclick}
		aria-label={label}
	>
		{@html AddIcon}
	</button>
{/if}
