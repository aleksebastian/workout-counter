<script lang="ts">
	import CloseButton from './Buttons/CloseButton.svelte';
	import { fade } from 'svelte/transition';
	import { type Toast } from '$lib/state.svelte';

	interface Props {
		type?: Toast['type'];
		message: Toast['message'];
		dismissible: Toast['dismissible'];
		dismiss: () => void;
	}

	let { type = 'info', message, dismissible, dismiss }: Props = $props();
</script>

<div class={`alert alert-${type}`} out:fade={{ duration: 150 }}>
	<span class="flex items-center justify-between gap-2">
		{message}
		{#if dismissible}
			<CloseButton onclick={dismiss} />
		{/if}
	</span>
</div>
