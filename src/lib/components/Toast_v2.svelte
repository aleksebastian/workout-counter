<script lang="ts">
	import CloseButton from './Buttons/CloseButton.svelte';
	import { fade } from 'svelte/transition';
	import type { Toast } from '$lib/types';

	interface Props {
		type?: Toast['type'];
		message: Toast['message'];
		dismissible: Toast['dismissible'];
		action?: Toast['action'];
		dismiss: () => void;
	}

	let { type = 'info', message, dismissible, action, dismiss }: Props = $props();
</script>

<div class={`alert alert-${type}`} out:fade={{ duration: 150 }}>
	<span class="flex items-center justify-between gap-2">
		{message}
		{#if action}
			<button
				class="btn btn-ghost -my-3 -mr-3 h-11 min-h-0 px-3 font-bold"
				onclick={() => {
					action.onClick();
					dismiss();
				}}>{action.label}</button
			>
		{/if}
		{#if dismissible}
			<CloseButton onclick={dismiss} />
		{/if}
	</span>
</div>
