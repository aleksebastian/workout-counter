<script lang="ts">
	import { type Workout } from '$lib/store';
	import Dialog from '$lib/components/Dialog.svelte';
	import DialogHeader from '$lib/components/DialogHeader.svelte';
	import DialogAction from '$lib/components/DialogAction.svelte';

	export let dialog: HTMLDialogElement;
	export let inputEle: HTMLInputElement;
	export let editingWorkout: Workout | undefined;
	export let name: string;
	export let editWorkoutError: string | undefined;

	$: editingWorkout && getEditingWorkoutName();

	function getEditingWorkoutName() {
		if (editingWorkout) {
			name = editingWorkout.name;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			dialog.returnValue = 'edit';
			dialog.close();
		}
	}
</script>

<Dialog bind:dialog on:close>
	<DialogHeader header="Edit Workout" closeButton on:close-click={() => dialog.close()} />

	<input
		aria-label="Workout Name"
		bind:this={inputEle}
		type="text"
		class="input input-bordered w-full max-w-xs"
		bind:value={name}
		on:keydown={handleKeyDown}
	/>

	<DialogAction>
		<div class="flex gap-4">
			{#if editWorkoutError}
				<p class="text-red-500">{editWorkoutError}</p>
			{/if}
			<button class="btn btn-primary" value="delete">Delete</button>
			<button class="btn" value="edit">Save</button>
		</div>
	</DialogAction>
</Dialog>
