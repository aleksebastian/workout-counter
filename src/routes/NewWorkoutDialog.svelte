<script lang="ts">
	import { workouts$ } from '$lib/store';
	import Dialog from '$lib/components/Dialog.svelte';
	import DialogHeader from '$lib/components/DialogHeader.svelte';

	export let dialog: HTMLDialogElement;
	export let inputEle: HTMLInputElement;
	export let newWorkoutName: string;
	export let newWorkoutError: string | undefined;

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();

			if (
				$workouts$.some((workout) => workout.name.toLowerCase() === newWorkoutName.toLowerCase())
			) {
				newWorkoutError = 'Workout already exists';
			} else if (!newWorkoutName.length) {
				newWorkoutError = 'Workout name missing';
			}

			if (!newWorkoutError) {
				dialog.returnValue = 'add';
				dialog.close();
			}
		}
	}

	function handleAddClick(event: MouseEvent) {
		if ($workouts$.some((workout) => workout.name.toLowerCase() === newWorkoutName.toLowerCase())) {
			newWorkoutError = 'Workout already exists';
		} else if (!newWorkoutName.length) {
			newWorkoutError = 'Workout name missing';
		}

		if (newWorkoutError) {
			event.preventDefault();
		}
	}

	function handleInput() {
		newWorkoutError = undefined;
	}
</script>

<Dialog bind:dialog on:close>
	<DialogHeader header="Workout Name" closeButton />

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
		<button class="btn" value="add" on:click={handleAddClick}>Add</button>
	</div>
</Dialog>
