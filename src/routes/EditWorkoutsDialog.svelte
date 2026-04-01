<script lang="ts">
	import { type Workout } from '$lib/state.svelte';
	import Dialog from '$lib/components/Dialog/Dialog.svelte';
	import DialogHeader from '$lib/components/Dialog/DialogHeader.svelte';
	import DialogAction from '$lib/components/Dialog/DialogAction.svelte';
	import { userData } from '$lib/firebase';
	import { getWorkoutNameValidationMsg } from '$lib/utils';
	import DeleteIcon from '$lib/icons/delete.svg?raw';

	interface Props {
		dialog: HTMLDialogElement;
		inputEle: HTMLInputElement;
		editingWorkout: Workout | undefined;
		name: string;
		onclose: (event: Event) => void;
	}

	let {
		dialog = $bindable(),
		inputEle = $bindable(),
		editingWorkout,
		name = $bindable(),
		onclose
	}: Props = $props();

	let editWorkoutError: string | undefined = $state();
	let confirmingDelete = $state(false);

	function setEditingWorkoutName() {
		if (editingWorkout) {
			name = editingWorkout.name;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		editWorkoutError = undefined;
		if (event.key === 'Enter') {
			event.preventDefault();

			editWorkoutError = getWorkoutNameValidationMsg(name, $userData?.workouts);

			if (dialog && !editWorkoutError) {
				dialog.returnValue = 'edit';
				dialog.close();
			}
		}
	}

	function handleSaveClick(event: MouseEvent) {
		editWorkoutError = getWorkoutNameValidationMsg(name, $userData?.workouts);

		if (editWorkoutError) {
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
		editWorkoutError = undefined;
		confirmingDelete = false;
		onclose(e);
	}

	$effect(() => {
		editingWorkout && setEditingWorkoutName();
	});
</script>

<Dialog bind:dialog onclose={handleClose}>
	<DialogHeader header="Edit Exercise" closeButton />

	{#if confirmingDelete}
		<div class="flex flex-col items-center gap-3 py-2 text-center">
			<div
				class="bg-error/10 text-error flex items-center justify-center rounded-full p-3 [&>svg]:h-6 [&>svg]:w-6"
			>
				{@html DeleteIcon}
			</div>
			<div>
				<p class="font-semibold">Delete "{editingWorkout?.name}"?</p>
				<p class="text-base-content/50 mt-1 text-sm">
					{#if (editingWorkout?.sets?.length ?? 0) > 0}
						Permanently removes it and all {editingWorkout!.sets.length} sets.
					{:else}
						This action cannot be undone.
					{/if}
				</p>
			</div>
		</div>
	{:else}
		<div class="flex flex-col gap-1.5">
			<label class="text-base-content/60 text-sm font-medium" for="edit-exercise-name">Name</label>
			<input
				id="edit-exercise-name"
				aria-label="Workout Name"
				bind:this={inputEle}
				type="text"
				class="input input-bordered w-full"
				bind:value={name}
				onkeydown={handleKeyDown}
			/>
			<p class="text-error min-h-5 px-0.5 text-xs">{editWorkoutError ?? ''}</p>
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
