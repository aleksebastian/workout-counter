<script lang="ts">
	import Dialog from './Dialog/Dialog.svelte';
	import DialogAction from './Dialog/DialogAction.svelte';
	import DialogHeader from './Dialog/DialogHeader.svelte';

	interface Props {
		header?: string;
		actionLabel?: string;
		cancelLabel?: string;
		content?: string | undefined;
		dialog: HTMLDialogElement;
		onclose: (event: Event) => void;
	}

	let {
		header = 'Are you sure?',
		actionLabel = 'Ok',
		cancelLabel = 'Cancel',
		content = undefined,
		dialog = $bindable(),
		onclose
	}: Props = $props();
</script>

<Dialog bind:dialog {onclose}>
	<DialogHeader {header} />
	{#if content}
		<div>{content}</div>
	{/if}
	<DialogAction>
		<button class="btn" value="cancel">{cancelLabel}</button>
		<button class="btn btn-primary" value="default">{actionLabel}</button>
	</DialogAction>
</Dialog>
