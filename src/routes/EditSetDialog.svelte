<script lang="ts">
	import Dialog from '$lib/components/Dialog/Dialog.svelte';
	import DialogHeader from '$lib/components/Dialog/DialogHeader.svelte';
	import DialogAction from '$lib/components/Dialog/DialogAction.svelte';

	interface Props {
		dialog: HTMLDialogElement;
		inputEle: HTMLInputElement;
		reps: number;
		onclose: (event: Event) => void;
	}

	let {
		dialog = $bindable(),
		inputEle = $bindable(),
		reps = $bindable(),
		onclose
	}: Props = $props();

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			dialog.returnValue = 'default';
			dialog.close();
		}
	}
</script>

<Dialog bind:dialog {onclose}>
	<DialogHeader header="Edit Set" closeButton />

	<input
		aria-label="Reps"
		class="input input-bordered w-full max-w-xs"
		type="number"
		bind:this={inputEle}
		bind:value={reps}
		onkeydown={handleKeyDown}
	/>

	<DialogAction>
		<button class="btn" value="default">Save</button>
	</DialogAction>
</Dialog>
