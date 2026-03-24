<script lang="ts">
	import { type Routine } from '$lib/state.svelte';
	import Dialog from '$lib/components/Dialog/Dialog.svelte';
	import DialogHeader from '$lib/components/Dialog/DialogHeader.svelte';
	import DialogAction from '$lib/components/Dialog/DialogAction.svelte';
	import { userData } from '$lib/firebase';
	import { getRoutineNameValidationMsg } from '$lib/utils';

	interface Props {
		dialog: HTMLDialogElement;
		inputEle: HTMLInputElement;
		editingRoutine: Routine | undefined;
		name: string;
		onclose: (event: Event) => void;
	}

	let {
		dialog = $bindable(),
		inputEle = $bindable(),
		editingRoutine,
		name = $bindable(),
		onclose
	}: Props = $props();

	let editError: string | undefined = $state();
	let confirmingDelete = $state(false);

	function setEditingRoutineName() {
		if (editingRoutine) {
			name = editingRoutine.name;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		editError = undefined;
		if (event.key === 'Enter') {
			event.preventDefault();

			editError = getRoutineNameValidationMsg(name, $userData?.routines);

			if (dialog && !editError) {
				dialog.returnValue = 'edit';
				dialog.close();
			}
		}
	}

	function handleSaveClick(event: MouseEvent) {
		editError = getRoutineNameValidationMsg(name, $userData?.routines);

		if (editError) {
			event.preventDefault();
		}
	}

	function handleDeleteClick(event: MouseEvent) {
		if (!confirmingDelete) {
			event.preventDefault();
			confirmingDelete = true;
		} else {
			confirmingDelete = false;
		}
	}

	function handleClose(e: any) {
		editError = undefined;
		confirmingDelete = false;
		onclose(e);
	}

	$effect(() => {
		editingRoutine && setEditingRoutineName();
	});
</script>

<Dialog bind:dialog onclose={handleClose}>
	<DialogHeader header="Edit Routine" closeButton />
	{#if confirmingDelete}
		<p class="h-20 text-red-500">Are you sure you want to delete this routine?</p>
	{:else}
		<div class="flex flex-col gap-2">
			<input
				aria-label="Routine Name"
				bind:this={inputEle}
				type="text"
				class="input input-bordered w-full max-w-xs"
				bind:value={name}
				onkeydown={handleKeyDown}
			/>
			{#if editError}
				<p class="min-h-6 px-2 text-red-500">{editError}</p>
			{:else}
				<div class="min-h-6"></div>
			{/if}
		</div>
	{/if}

	<DialogAction noTopMargin>
		{#if confirmingDelete}
			<button class="btn btn-primary" value="cancel" onclick={() => (confirmingDelete = false)}
				>Cancel</button
			>
			<button class="btn" value="delete">Delete</button>
		{:else}
			<button class="btn btn-primary" onclick={handleDeleteClick}>Delete</button>
			<button class="btn w-20" value="edit" onclick={handleSaveClick}>Save</button>
		{/if}
	</DialogAction>
</Dialog>
