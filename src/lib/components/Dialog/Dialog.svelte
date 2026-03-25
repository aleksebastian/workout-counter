<script lang="ts">
	import { scrollLock } from '$lib/actions';

	interface Props {
		dialog: HTMLDialogElement;
		children?: import('svelte').Snippet;
		onclose: (event: Event) => void;
	}

	let { dialog = $bindable(), children, onclose }: Props = $props();
</script>

<dialog use:scrollLock bind:this={dialog} {onclose} class="modal">
	<form method="dialog" class="modal-box flex w-80 flex-col gap-4">
		{@render children?.()}
	</form>
</dialog>
