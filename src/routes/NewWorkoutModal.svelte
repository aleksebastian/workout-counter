<script lang="ts">
	import { selectedWorkout$, workouts$ } from '$lib/store';
	import { v4 as uuidv4 } from 'uuid';
	import CloseIcon from '$lib/icons/close.svg?raw';

	export let open: boolean;

	let modalEle: HTMLDialogElement | undefined = undefined;
	let inputEle: HTMLInputElement | undefined = undefined;
	let workoutName = '';
	let workoutAlreadyExistsError = false;

	$: open && modalEle?.showModal();
	$: open && inputEle?.focus();

	function clearWorkoutNameField() {
		workoutName = '';
	}

	function handleAddWorkoutBtnClick(event: MouseEvent) {
		if ($workouts$.some((workout) => workout.name === workoutName)) {
			event.preventDefault();
			workoutAlreadyExistsError = true;
			return;
		}

		$workouts$ = [...$workouts$, { id: uuidv4(), name: workoutName, sets: [] }];
		localStorage.setItem('workouts', JSON.stringify($workouts$));
		clearWorkoutNameField();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && open) {
			if ($workouts$.some((workout) => workout.name === workoutName)) {
				event.preventDefault();
				workoutAlreadyExistsError = true;
				return;
			}

			$workouts$ = [...$workouts$, { id: uuidv4(), name: workoutName, sets: [] }];
			localStorage.setItem('workouts', JSON.stringify($workouts$));

			modalEle?.close();
			$selectedWorkout$ = $workouts$.find((workout) => workout.name === workoutName);
			clearWorkoutNameField();
		}
	}
</script>

<dialog bind:this={modalEle} class="modal" on:close={() => (open = false)}>
	<div class="modal-box flex w-96 flex-col gap-6">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-bold">Workout name</h3>
			<button class="btn btn-ghost" on:click={() => modalEle?.close()}>{@html CloseIcon}</button>
		</div>
		<input
			bind:this={inputEle}
			type="text"
			class="input w-full max-w-xs"
			bind:value={workoutName}
			on:input={() => (workoutAlreadyExistsError = false)}
			on:keydown={handleKeyDown}
		/>
		<div class="modal-action flex items-center gap-8">
			{#if workoutAlreadyExistsError}
				<p class="text-red-500">Workout already exists</p>
			{/if}
			<form method="dialog">
				<!-- if there is a button in form, it will close the modal -->
				<button class="btn" on:click={handleAddWorkoutBtnClick}>Add</button>
			</form>
		</div>
	</div>
</dialog>
