<script lang="ts">
	import Dialog from '$lib/components/Dialog/Dialog.svelte';
	import DialogHeader from '$lib/components/Dialog/DialogHeader.svelte';
	import DialogAction from '$lib/components/Dialog/DialogAction.svelte';
	import { userData } from '$lib/firebase';
	import { getRoutineNameValidationMsg } from '$lib/utils';

	interface Props {
		dialog: HTMLDialogElement;
		inputEle: HTMLInputElement;
		newRoutineName: string;
		onclose: (event: Event) => void;
	}

	let {
		dialog = $bindable(),
		inputEle = $bindable(),
		newRoutineName = $bindable(),
		onclose
	}: Props = $props();

	let validationMsg: string | undefined = $state();

	function handleKeyDown(event: KeyboardEvent) {
		validationMsg = undefined;
		if (event.key === 'Enter') {
			event.preventDefault();

			validationMsg = getRoutineNameValidationMsg(newRoutineName, $userData?.routines);

			if (!validationMsg) {
				dialog.returnValue = 'add';
				dialog.close();
			}
		}
	}

	function handleAddClick(event: MouseEvent) {
		validationMsg = getRoutineNameValidationMsg(newRoutineName, $userData?.routines);

		if (validationMsg) {
			event.preventDefault();
		}
	}

	function handleClose(e: any) {
		validationMsg = undefined;
		onclose(e);
	}
</script>

<Dialog bind:dialog onclose={handleClose}>
	<DialogHeader header="Routine Name" closeButton />

	<div class="flex flex-col gap-2">
		<input
			bind:this={inputEle}
			aria-label="Routine Name"
			type="text"
			class="input input-bordered w-full max-w-xs"
			bind:value={newRoutineName}
			onkeydown={handleKeyDown}
		/>
		{#if validationMsg}
			<p class="text-red-500">{validationMsg}</p>
		{:else}
			<div class="min-h-6"></div>
		{/if}
	</div>

	<DialogAction noTopMargin>
		<button class="btn" value="add" onclick={handleAddClick}>Add</button>
	</DialogAction>
</Dialog>
