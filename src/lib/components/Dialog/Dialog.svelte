<script lang="ts">
	interface Props {
		dialog: HTMLDialogElement;
		children?: import('svelte').Snippet;
		onclose: (event: Event) => void;
	}

	let { dialog = $bindable(), children, onclose }: Props = $props();
</script>

<dialog bind:this={dialog} {onclose} class="modal">
	<form method="dialog" class="modal-box flex w-80 flex-col gap-4">
		{@render children?.()}
	</form>
</dialog>
