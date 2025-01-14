<script lang="ts">
	import Dialog from '$lib/components/Dialog/Dialog.svelte';
	import DialogHeader from '$lib/components/Dialog/DialogHeader.svelte';
	import DialogAction from '$lib/components/Dialog/DialogAction.svelte';
	import { userData } from '$lib/firebase';
	import { getWorkoutNameValidationMsg } from '$lib/utils';

	interface Props {
		dialog: HTMLDialogElement;
		inputEle: HTMLInputElement;
		newWorkoutName: string;
		onclose: (event: Event) => void;
	}

	let {
		dialog = $bindable(),
		inputEle = $bindable(),
		newWorkoutName = $bindable(),
		onclose
	}: Props = $props();

	let newWorkoutValidationMsg: string | undefined = $state();

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

	function handleClose(e: any) {
		newWorkoutValidationMsg = undefined;
		onclose(e);
	}
</script>

<Dialog bind:dialog onclose={handleClose}>
	<DialogHeader header="Workout Name" closeButton />

	<div class="flex flex-col gap-2">
		<input
			bind:this={inputEle}
			aria-label="Workout Name"
			type="text"
			class="input input-bordered w-full max-w-xs"
			bind:value={newWorkoutName}
			onkeydown={handleKeyDown}
		/>
		{#if newWorkoutValidationMsg}
			<p class="text-red-500">{newWorkoutValidationMsg}</p>
		{:else}
			<div class="min-h-6"></div>
		{/if}
	</div>

	<DialogAction noTopMargin>
		<button class="btn" value="add" onclick={handleAddClick}>Add</button>
	</DialogAction>
</Dialog>
