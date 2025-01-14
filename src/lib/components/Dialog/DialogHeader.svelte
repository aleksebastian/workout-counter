<script lang="ts">
	import CloseIcon from '$lib/icons/close.svg?raw';

	interface Props {
		header?: string;
		closeButton?: boolean;
	}

	let { header = '', closeButton = false }: Props = $props();
</script>

<div class="flex items-center justify-between">
	<h3 class="heigh text-lg font-bold">{header}</h3>
	{#if closeButton}
		<button value="close" aria-label="Close Dialog" class="btn btn-ghost">
			{@html CloseIcon}
		</button>
	{/if}
</div>
