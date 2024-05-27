<script lang="ts">
	import { workouts$ } from '$lib/store';
	import Dialog from '$lib/components/Dialog.svelte';
	import DialogHeader from '$lib/components/DialogHeader.svelte';

	export let dialog: HTMLDialogElement;
	export let inputEle: HTMLInputElement;
	export let newWorkoutName: string;
	export let newWorkoutError: string | undefined = undefined;

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			if ($workouts$.some((workout) => workout.name === newWorkoutName)) {
				newWorkoutError = 'Workout already exists';
				return;
			} else if (!newWorkoutName.length) {
				newWorkoutError = 'Workout name missing';
				return;
			}

			dialog.returnValue = 'add';
			dialog.close();
		}
	}

	function handleAddClick(event: MouseEvent) {
		event.preventDefault();
		if ($workouts$.some((workout) => workout.name === newWorkoutName)) {
			newWorkoutError = 'Workout already exists';
			return;
		} else if (!newWorkoutName.length) {
			newWorkoutError = 'Workout name missing';
			return;
		}
	}

	function handleInput() {
		newWorkoutError = undefined;
	}
</script>

<Dialog bind:dialog on:close>
	<DialogHeader header="Workout Name" closeButton on:close-click={() => dialog.close()} />

	<input
		bind:this={inputEle}
		aria-label="Workout Name"
		type="text"
		class="input input-bordered w-full max-w-xs"
		bind:value={newWorkoutName}
		on:input={handleInput}
		on:keydown={handleKeyDown}
	/>

	<div class="modal-action mt-0.5 flex items-center gap-8">
		{#if newWorkoutError}
			<p class="text-red-500">{newWorkoutError}</p>
		{/if}
		<form method="dialog">
			<!-- if there is a button in form, it will close the modal -->
			<button class="btn" value="add" on:click={handleAddClick}>Add</button>
		</form>
	</div>
</Dialog>
