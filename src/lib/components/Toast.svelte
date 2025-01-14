<script lang="ts">
	import { fade } from 'svelte/transition';

	interface Props {
		styles: string;
		children?: import('svelte').Snippet;
	}

	let { styles, children }: Props = $props();
</script>

<div class="toast toast-end" transition:fade={{ duration: 250 }}>
	<div class="alert alert-info flex gap-2 bg-neutral text-neutral-content {styles}">
		{@render children?.()}
	</div>
</div>
