<script lang="ts">
	import Dialog from '$lib/components/Dialog/Dialog.svelte';
	import DialogHeader from '$lib/components/Dialog/DialogHeader.svelte';
	import DialogAction from '$lib/components/Dialog/DialogAction.svelte';
	import { userData } from '$lib/firebase';

	interface Props {
		dialog: HTMLDialogElement;
		inputEle: HTMLInputElement;
		reps: number;
		weight: number;
		onclose: (event: Event) => void;
	}

	let {
		dialog = $bindable(),
		inputEle = $bindable(),
		reps = $bindable(),
		weight = $bindable(),
		onclose
	}: Props = $props();

	let weightUnit = $derived($userData?.preferences?.weightUnit ?? 'lbs');

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

	<div class="flex w-full max-w-xs flex-col gap-1">
		<label class="text-sm font-medium" for="edit-reps">Reps</label>
		<input
			id="edit-reps"
			aria-label="Reps"
			class="input input-bordered w-full"
			type="number"
			bind:this={inputEle}
			bind:value={reps}
			onkeydown={handleKeyDown}
		/>
	</div>
	<div class="flex w-full max-w-xs flex-col gap-1">
		<label class="text-sm font-medium" for="edit-weight">Weight ({weightUnit})</label>
		<input
			id="edit-weight"
			aria-label="Weight"
			class="input input-bordered w-full"
			type="number"
			placeholder="Optional"
			bind:value={weight}
			min="0"
			onkeydown={handleKeyDown}
		/>
	</div>

	<DialogAction>
		<button class="btn" value="default">Save</button>
	</DialogAction>
</Dialog>
