<script lang="ts">
	import { selectedWorkout$, workouts$, type Workout } from '$lib/store';
	import CloseIcon from '$lib/icons/close.svg?raw';

	export let open: boolean;
	export let editingWorkout: Workout | undefined;

	let modalEle: HTMLDialogElement | undefined = undefined;
	let inputEle: HTMLInputElement | undefined = undefined;
	let name = '';

	$: open && handleModalOpen();

	function handleModalOpen() {
		name = editingWorkout?.name ?? '';
		modalEle?.showModal();
		inputEle?.focus();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && open) {
			handleWorkoutEditClick();
			modalEle?.close();
		}
	}

	function handleWorkoutEditClick() {
		const index = $workouts$.findIndex((currWorkout) => currWorkout.id === editingWorkout?.id);

		$workouts$[index].name = name;

		$workouts$ = $workouts$;

		localStorage.setItem('workouts', JSON.stringify($workouts$));
	}

	function handleWorkoutDeleteClick() {
		const index = $workouts$.findIndex((currWorkout) => currWorkout.id === editingWorkout?.id);
		$workouts$.splice(index, 1);
		$workouts$ = $workouts$;

		if ($selectedWorkout$?.id === editingWorkout?.id) {
			$selectedWorkout$ = undefined;
		}

		localStorage.setItem('workouts', JSON.stringify($workouts$));
	}
</script>

<dialog bind:this={modalEle} class="modal" on:close={() => (open = false)}>
	<div class="modal-box flex w-96 flex-col gap-6">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-bold">Edit Workout</h3>
			<button class="btn" on:click={() => modalEle?.close()}>{@html CloseIcon}</button>
		</div>
		<input
			bind:this={inputEle}
			type="text"
			class="input w-full max-w-xs"
			bind:value={name}
			on:keydown={handleKeyDown}
		/>
		<div class="modal-action flex items-center gap-8">
			<form method="dialog" class="flex w-full justify-between">
				<button class="btn bg-red-500" on:click={handleWorkoutDeleteClick}>Delete</button>
				<!-- if there is a button in form, it will close the modal -->
				<button class="btn" on:click={handleWorkoutEditClick}>Save</button>
			</form>
		</div>
	</div>
</dialog>
