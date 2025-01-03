<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import CloseButton from './Buttons/CloseButton.svelte';
	import { fade } from 'svelte/transition';
	import { restTimer$, type Toast } from '$lib/store';

	export let type: Toast['type'] = 'info';
	export let message: Toast['message'];
	export let dismissible: Toast['dismissible'];

	const dispatch = createEventDispatcher<{ dismiss: null }>();
</script>

{#if type === 'rest'}
	{#if $restTimer$}
		<div
			class="alert alert-info flex min-w-36 justify-center gap-2 bg-neutral text-neutral-content"
		>
			<span>{$restTimer$}</span>
			<small> Next set</small>
		</div>
	{/if}
{:else}
	<div class={`alert alert-${type}`} out:fade={{ duration: 150 }}>
		<span class="flex items-center justify-between gap-2">
			{message}
			{#if dismissible}
				<CloseButton on:click={() => dispatch('dismiss')} />
			{/if}
		</span>
	</div>
{/if}
