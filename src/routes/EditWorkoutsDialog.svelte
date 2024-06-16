<script lang="ts">
	import { type Workout } from '$lib/store';
	import Dialog from '$lib/components/Dialog/Dialog.svelte';
	import DialogHeader from '$lib/components/Dialog/DialogHeader.svelte';
	import DialogAction from '$lib/components/Dialog/DialogAction.svelte';
	import { userData } from '$lib/firebase';
	import { getWorkoutNameValidationMsg } from '$lib/utils';

	export let dialog: HTMLDialogElement;
	export let inputEle: HTMLInputElement;
	export let editingWorkout: Workout | undefined;
	export let name: string;

	$: editingWorkout && setEditingWorkoutName();

	let editWorkoutError: string | undefined;
	let confirmingDelete = false;

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

			if (!editWorkoutError) {
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

	function handleClose() {
		editWorkoutError = undefined;
		confirmingDelete = false;
	}
</script>

<Dialog bind:dialog on:close on:close={handleClose}>
	<DialogHeader header="Edit Workout" closeButton />
	{#if confirmingDelete}
		<p class="h-20 text-red-500">Are you sure you want to delete this workout?</p>
	{:else}
		<div class="flex flex-col gap-2">
			<input
				aria-label="Workout Name"
				bind:this={inputEle}
				type="text"
				class="input input-bordered w-full max-w-xs"
				bind:value={name}
				on:keydown={handleKeyDown}
			/>
			{#if editWorkoutError}
				<p class="min-h-6 px-2 text-red-500">{editWorkoutError}</p>
			{:else}
				<div class="min-h-6"></div>
			{/if}
		</div>
	{/if}

	<DialogAction noTopMargin>
		{#if confirmingDelete}
			<button class="btn btn-primary" value="cancel" on:click={() => (confirmingDelete = false)}
				>Cancel</button
			>
			<button class="btn" value="delete">Delete</button>
		{:else}
			<button class="btn btn-primary" on:click={handleDeleteClick}>Delete</button>
			<button class="btn w-20" value="edit" on:click={handleSaveClick}>Save</button>
		{/if}
	</DialogAction>
</Dialog>
