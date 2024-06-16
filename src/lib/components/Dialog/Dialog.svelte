<script lang="ts">
	export let dialog: HTMLDialogElement;
</script>

<dialog bind:this={dialog} on:close class="modal">
	<form method="dialog" class="modal-box flex w-80 flex-col gap-4">
		<slot />
	</form>
</dialog>
