<script lang="ts">
	import Dialog from '$lib/components/Dialog/Dialog.svelte';
	import DialogHeader from '$lib/components/Dialog/DialogHeader.svelte';
	import DialogAction from '$lib/components/Dialog/DialogAction.svelte';
	import { userData } from '$lib/firebase';
	import { getProgramNameValidationMsg } from '$lib/utils';
	import { type Program } from '$lib/state.svelte';
	import DeleteIcon from '$lib/icons/delete.svg?raw';

	interface Props {
		dialog: HTMLDialogElement;
		inputEle: HTMLInputElement;
		editingProgram: Program | undefined;
		name: string;
		onclose: (event: Event) => void;
	}

	let {
		dialog = $bindable(),
		inputEle = $bindable(),
		editingProgram,
		name = $bindable(),
		onclose
	}: Props = $props();

	let editError: string | undefined = $state();
	let confirmingDelete = $state(false);

	function setEditingValues() {
		if (editingProgram) name = editingProgram.name;
	}

	function validate(): string | undefined {
		const nameMsg = getProgramNameValidationMsg(name, $userData?.programs);
		if (nameMsg && name.toLowerCase() !== editingProgram?.name.toLowerCase()) return nameMsg;
		return undefined;
	}

	function handleKeyDown(event: KeyboardEvent) {
		editError = undefined;
		if (event.key === 'Enter') {
			event.preventDefault();
			editError = validate();
			if (dialog && !editError) {
				dialog.returnValue = 'edit';
				dialog.close();
			}
		}
	}

	function handleSaveClick(event: MouseEvent) {
		editError = validate();
		if (editError) event.preventDefault();
	}

	function handleDeleteClick(event: MouseEvent) {
		if (!confirmingDelete) {
			event.preventDefault();
			confirmingDelete = true;
		}
	}

	function handleClose(e: any) {
		editError = undefined;
		confirmingDelete = false;
		onclose(e);
	}

	$effect(() => {
		editingProgram && setEditingValues();
	});
</script>

<Dialog bind:dialog onclose={handleClose}>
	<DialogHeader header="Edit Program" closeButton />

	{#if confirmingDelete}
		<div class="flex flex-col items-center gap-3 py-2 text-center">
			<div
				class="bg-error/10 text-error flex items-center justify-center rounded-full p-3 [&>svg]:h-6 [&>svg]:w-6"
			>
				{@html DeleteIcon}
			</div>
			<div>
				<p class="font-semibold">Delete "{editingProgram?.name}"?</p>
				<p class="text-base-content/50 mt-1 text-sm">This action cannot be undone.</p>
			</div>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			<div class="flex flex-col gap-1.5">
				<label class="text-base-content/60 text-sm font-medium" for="edit-session-name">Name</label>
				<input
					id="edit-session-name"
					bind:this={inputEle}
					aria-label="Session Name"
					type="text"
					class="input input-bordered w-full"
					bind:value={name}
					onkeydown={handleKeyDown}
				/>
			</div>
			<p class="text-error min-h-5 px-0.5 text-xs">{editError ?? ''}</p>
		</div>
	{/if}

	<DialogAction noTopMargin>
		{#if confirmingDelete}
			<button class="btn flex-1" type="button" onclick={() => (confirmingDelete = false)}
				>Cancel</button
			>
			<button class="btn btn-error flex-1" value="delete">Delete</button>
		{:else}
			<button class="btn btn-ghost text-error gap-1.5" onclick={handleDeleteClick}>
				<span class="[&>svg]:h-4 [&>svg]:w-4">{@html DeleteIcon}</span>
				Delete
			</button>
			<button class="btn btn-primary" value="edit" onclick={handleSaveClick}>Save</button>
		{/if}
	</DialogAction>
</Dialog>
