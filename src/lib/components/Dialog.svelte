<script lang="ts">
	export let dialog: HTMLDialogElement;
</script>

<dialog bind:this={dialog} on:close class="modal">
	<div class="modal-box flex w-80 flex-col gap-6">
		<slot />
	</div>
</dialog>
