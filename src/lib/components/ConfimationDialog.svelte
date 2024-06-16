<script lang="ts">
	import Dialog from './Dialog/Dialog.svelte';
	import DialogAction from './Dialog/DialogAction.svelte';
	import DialogHeader from './Dialog/DialogHeader.svelte';

	export let header = 'Are you sure?';
	export let actionLabel = 'Ok';
	export let cancelLabel = 'Cancel';

	export let dialog: HTMLDialogElement;
</script>

<Dialog bind:dialog on:close>
	<DialogHeader {header} />

	<DialogAction>
		<button class="btn" value="cancel">{cancelLabel}</button>
		<button class="btn btn-primary" value="default">{actionLabel}</button>
	</DialogAction>
</Dialog>
