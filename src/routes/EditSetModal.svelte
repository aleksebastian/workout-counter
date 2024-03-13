<script lang="ts">
	import { selectedWorkout$, workouts$ } from '$lib/store';
	import CloseIcon from '$lib/icons/close.svg?raw';

	export let open: boolean;
	export let editSetId: string | undefined;

	let modalEle: HTMLDialogElement | undefined = undefined;
	let inputEle: HTMLInputElement | undefined = undefined;
	let reps = 0;

	$: open && modalEle?.showModal();
	$: open && inputEle?.focus();

	function clearSetCountField() {
		reps = 0;
	}

	function handleSaveSetBtnClick() {
		$selectedWorkout$!.sets.find((set) => set.id === editSetId)!.reps = reps;
		const index = $workouts$.findIndex((workout) => workout.id === $selectedWorkout$!.id);

		$workouts$[index] = $selectedWorkout$!;
		$selectedWorkout$ = $selectedWorkout$;

		localStorage.setItem('workouts', JSON.stringify($workouts$));

		clearSetCountField();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && open) {
			handleSaveSetBtnClick();
			modalEle?.close();
			clearSetCountField();
		}
	}
</script>

<dialog bind:this={modalEle} class="modal" on:close={() => (open = false)}>
	<div class="modal-box flex w-96 flex-col gap-6">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-bold">Edit set</h3>
			<button class="btn" on:click={() => modalEle?.close()}>{@html CloseIcon}</button>
		</div>
		<input
			bind:this={inputEle}
			type="text"
			class="input w-full max-w-xs"
			bind:value={reps}
			on:keydown={handleKeyDown}
		/>
		<div class="modal-action flex items-center gap-8">
			<form method="dialog">
				<!-- if there is a button in form, it will close the modal -->
				<button class="btn" on:click={handleSaveSetBtnClick}>Save</button>
			</form>
		</div>
	</div>
</dialog>
