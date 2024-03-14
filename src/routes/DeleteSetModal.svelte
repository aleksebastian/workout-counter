<script lang="ts">
	import { selectedWorkout$, workouts$ } from '$lib/store';

	export let open: boolean;
	export let editSetId: string | undefined;

	let modalEle: HTMLDialogElement | undefined = undefined;

	$: open && modalEle?.showModal();

	function handleDeleteSetBtnClick() {
		$workouts$ = $workouts$.map((workout) => {
			if (workout.id === $selectedWorkout$!.id) {
				workout.sets = workout.sets.filter((set) => set.id !== editSetId);
			}
			return workout;
		});

		$selectedWorkout$ = $selectedWorkout$;

		localStorage.setItem('workouts', JSON.stringify($workouts$));
	}
</script>

<dialog bind:this={modalEle} class="modal" on:close={() => (open = false)}>
	<div class="modal-box flex w-80 flex-col gap-6">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-bold">Are you sure?</h3>
		</div>

		<div class="modal-action">
			<form method="dialog" class="flex justify-end gap-4">
				<!-- if there is a button in form, it will close the modal -->
				<button class="btn">Cancel</button>
				<button class="btn" on:click={handleDeleteSetBtnClick}>Delete</button>
			</form>
		</div>
	</div>
</dialog>
