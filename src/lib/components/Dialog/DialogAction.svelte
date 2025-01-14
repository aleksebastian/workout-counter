<script lang="ts">
	interface Props {
		noTopMargin?: boolean;
		children?: import('svelte').Snippet;
	}

	let { noTopMargin = false, children }: Props = $props();
</script>

<div class="modal-action gap-4" class:mt-0={noTopMargin}>
	{@render children?.()}
</div>
