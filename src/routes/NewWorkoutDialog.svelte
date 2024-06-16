<script lang="ts">
	import Dialog from '$lib/components/Dialog/Dialog.svelte';
	import DialogHeader from '$lib/components/Dialog/DialogHeader.svelte';
	import DialogAction from '$lib/components/Dialog/DialogAction.svelte';
	import { userData } from '$lib/firebase';
	import { getWorkoutNameValidationMsg } from '$lib/utils';

	export let dialog: HTMLDialogElement;
	export let inputEle: HTMLInputElement;
	export let newWorkoutName: string;

	let newWorkoutValidationMsg: string | undefined;

	function handleKeyDown(event: KeyboardEvent) {
		newWorkoutValidationMsg = undefined;
		if (event.key === 'Enter') {
			event.preventDefault();

			newWorkoutValidationMsg = getWorkoutNameValidationMsg(newWorkoutName, $userData?.workouts);

			if (!newWorkoutValidationMsg) {
				dialog.returnValue = 'add';
				dialog.close();
			}
		}
	}

	function handleAddClick(event: MouseEvent) {
		newWorkoutValidationMsg = getWorkoutNameValidationMsg(newWorkoutName, $userData?.workouts);

		if (newWorkoutValidationMsg) {
			event.preventDefault();
		}
	}

	function handleClose() {
		newWorkoutValidationMsg = undefined;
	}
</script>

<Dialog bind:dialog on:close on:close={handleClose}>
	<DialogHeader header="Workout Name" closeButton />

	<div class="flex flex-col gap-2">
		<input
			bind:this={inputEle}
			aria-label="Workout Name"
			type="text"
			class="input input-bordered w-full max-w-xs"
			bind:value={newWorkoutName}
			on:keydown={handleKeyDown}
		/>
		{#if newWorkoutValidationMsg}
			<p class="text-red-500">{newWorkoutValidationMsg}</p>
		{:else}
			<div class="min-h-6"></div>
		{/if}
	</div>

	<DialogAction noTopMargin>
		<button class="btn" value="add" on:click={handleAddClick}>Add</button>
	</DialogAction>
</Dialog>
