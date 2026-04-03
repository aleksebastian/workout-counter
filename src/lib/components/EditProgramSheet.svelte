<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { type Program } from '$lib/state.svelte';
	import { userData } from '$lib/firebase';
	import { getProgramNameValidationMsg } from '$lib/utils';
	import DeleteIcon from '$lib/icons/delete.svg?raw';

	interface Props {
		open?: boolean;
		editingProgram?: Program;
		name?: string;
		onSave?: (name: string) => void;
		onDelete?: () => void;
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		editingProgram,
		name = $bindable(''),
		onSave,
		onDelete,
		onCancel
	}: Props = $props();

	let inputEle: HTMLInputElement = $state()!;
	let editError: string | undefined = $state();
	let confirmingDelete = $state(false);

	function validate(): string | undefined {
		const nameMsg = getProgramNameValidationMsg(name, $userData?.programs);
		if (nameMsg && name.toLowerCase() !== editingProgram?.name.toLowerCase()) return nameMsg;
		return undefined;
	}

	function handleSave() {
		editError = validate();

		if (!editError) {
			onSave?.(name);
			open = false;
			confirmingDelete = false;
		}
	}

	function handleDelete() {
		onDelete?.();
		open = false;
		confirmingDelete = false;
	}

	function handleCancel() {
		editError = undefined;
		confirmingDelete = false;
		open = false;
		onCancel?.();
	}

	function handleDeleteClick() {
		confirmingDelete = true;
	}

	function handleCancelDelete() {
		confirmingDelete = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		editError = undefined;
		if (event.key === 'Enter') {
			event.preventDefault();
			handleSave();
		}
	}

	// Set name when editingProgram changes
	$effect(() => {
		if (editingProgram) {
			name = editingProgram.name;
		}
	});

	// Auto-focus input when opened
	$effect(() => {
		if (open && inputEle && !confirmingDelete) {
			setTimeout(() => inputEle.focus(), 100);
		}
	});
</script>

<BottomSheet bind:open size="small" title="Edit Program" onClose={handleCancel}>
	<div class="flex flex-col gap-4">
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

			<div class="flex gap-2">
				<button class="btn btn-ghost flex-1" onclick={handleCancelDelete}>Cancel</button>
				<button class="btn btn-error flex-1" onclick={handleDelete}>Delete</button>
			</div>
		{:else}
			<div class="flex flex-col gap-1.5">
				<label class="text-base-content/60 text-sm font-medium" for="edit-program-name">Name</label>
				<input
					id="edit-program-name"
					bind:this={inputEle}
					aria-label="Program Name"
					type="text"
					class="input input-bordered w-full"
					bind:value={name}
					onkeydown={handleKeyDown}
				/>
				{#if editError}
					<p class="text-error px-0.5 text-xs">{editError}</p>
				{/if}
			</div>

			<div class="flex gap-2">
				<button class="btn btn-ghost text-error flex-1 gap-1.5" onclick={handleDeleteClick}>
					<span class="[&>svg]:h-4 [&>svg]:w-4">{@html DeleteIcon}</span>
					Delete
				</button>
				<button class="btn btn-primary flex-1" onclick={handleSave}>Save</button>
			</div>
		{/if}
	</div>
</BottomSheet>
