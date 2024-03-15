<script lang="ts">
	import Dialog from './Dialog.svelte';
	import DialogHeader from './DialogHeader.svelte';

	export let header = 'Are you sure?';
	export let actionLabel = 'Ok';
	export let cancelLabel = 'Cancel';

	export let dialog: HTMLDialogElement;
</script>

<Dialog bind:dialog on:close>
	<DialogHeader {header} />

	<div class="modal-action">
		<form method="dialog" class="flex justify-end gap-4">
			<!-- if there is a button in form, it will close the modal -->
			<button class="btn" value="cancel">{cancelLabel}</button>
			<button class="btn btn-primary" value="default">{actionLabel}</button>
		</form>
	</div>
</Dialog>
