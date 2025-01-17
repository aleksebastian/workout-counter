<script lang="ts">
	import { type Workout } from '$lib/state.svelte';
	import Dialog from '$lib/components/Dialog/Dialog.svelte';
	import DialogHeader from '$lib/components/Dialog/DialogHeader.svelte';
	import DialogAction from '$lib/components/Dialog/DialogAction.svelte';
	import { userData } from '$lib/firebase';
	import { getWorkoutNameValidationMsg } from '$lib/utils';

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
				onkeydown={handleKeyDown}
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
