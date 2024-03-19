<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import CloseIcon from '$lib/icons/close.svg?raw';

	export let header: string;
	export let closeButton = false;

	const dispatch = createEventDispatcher<{
		'close-click': MouseEvent;
	}>();

	function handleCloseClick(e: MouseEvent) {
		dispatch('close-click', e);
	}
</script>

<div class="flex items-center justify-between">
	<h3 class="heigh text-lg font-bold">{header}</h3>
	{#if closeButton}
		<button aria-label="Close Dialog" class="btn btn-ghost" on:click={handleCloseClick}>
			{@html CloseIcon}
		</button>
	{/if}
</div>
