<script lang="ts">
	import Dialog from '$lib/components/Dialog.svelte';
	import DialogHeader from '$lib/components/DialogHeader.svelte';
	import DialogAction from '$lib/components/DialogAction.svelte';

	export let dialog: HTMLDialogElement;
	export let inputEle: HTMLInputElement;
	export let reps: number;

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			dialog.returnValue = 'default';
			dialog.close();
		}
	}
</script>

<Dialog bind:dialog on:close>
	<DialogHeader header="Edit Set" closeButton on:close-click={() => dialog.close()} />

	<input
		class="input input-bordered w-full max-w-xs"
		type="number"
		bind:this={inputEle}
		bind:value={reps}
		on:keydown={handleKeyDown}
	/>

	<DialogAction>
		<button class="btn" value="default">Save</button>
	</DialogAction>
</Dialog>
