<script lang="ts">
	import { scale } from 'svelte/transition';
	import AddIcon from '$lib/icons/add.svg?raw';

	let { onclick, hidden = false }: { onclick: () => void; hidden?: boolean } = $props();
</script>

{#if !hidden}
	<button
		transition:scale={{ duration: 150, start: 0.8 }}
		class="btn btn-circle btn-lg btn-primary fixed z-50 shadow-xl [&>svg]:h-6 [&>svg]:w-6"
		style="bottom: calc(4rem + env(safe-area-inset-bottom, 0px) + 0.75rem); right: 1rem;"
		{onclick}
		aria-label="Add"
	>
		{@html AddIcon}
	</button>
{/if}
