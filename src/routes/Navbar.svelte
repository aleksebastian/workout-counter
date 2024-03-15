<script lang="ts">
	import '../app.css';
	import NewWorkoutDialog from './NewWorkoutDialog.svelte';
	import AddIcon from '$lib/icons/add.svg?raw';
	import { createEventDispatcher, tick } from 'svelte';
	import { isMobileDevice$, selectedWorkout$, workouts$ } from '$lib/store';
	import { v4 as uuidv4 } from 'uuid';
	import MenuIcon from '$lib/icons/menu.svg?raw';

	const dispatch = createEventDispatcher<{
		toggleDrawer: null;
	}>();

	function toggleDrawer() {
		dispatch('toggleDrawer');
	}

	let newWorkoutDialog: HTMLDialogElement;
	let inputEle: HTMLInputElement;
	let newWorkoutName = '';
	let newWorkoutError: string | undefined = undefined;

	function handleNewWorkoutDialogResult() {
		if (newWorkoutDialog.returnValue === 'add') {
			if ($workouts$.some((workout) => workout.name === newWorkoutName)) {
				newWorkoutError = 'Workout already exists';
				return;
			} else if (!newWorkoutName.length) {
				newWorkoutError = 'Workout name missing';
				return;
			}

			$workouts$ = [...$workouts$, { id: uuidv4(), name: newWorkoutName, sets: [] }];
			$selectedWorkout$ = $workouts$[$workouts$.length - 1];
			localStorage.setItem('workouts', JSON.stringify($workouts$));
			clearWorkoutNameField();
		}
	}

	function clearWorkoutNameField() {
		newWorkoutName = '';
	}

	async function handleNewWorkoutDialogOpen() {
		newWorkoutDialog.showModal();

		if ($isMobileDevice$) {
			return;
		}

		await tick();

		inputEle.focus();
		inputEle.select();
	}
</script>

<div class="navbar flex items-center justify-between bg-base-100 p-4">
	<div>
		<button on:click={toggleDrawer}>
			<label for="my-drawer-3" aria-label="open sidebar" class="btn btn-square btn-ghost">
				{@html MenuIcon}
			</label>
		</button>
		<a class="btn btn-ghost text-xl" href="/">Workout Counter</a>
	</div>
	<div>
		<button class="btn" on:click={handleNewWorkoutDialogOpen}>{@html AddIcon} Workout</button>
	</div>
</div>

<NewWorkoutDialog
	bind:dialog={newWorkoutDialog}
	bind:inputEle
	bind:newWorkoutName
	bind:newWorkoutError
	on:close={handleNewWorkoutDialogResult}
/>
