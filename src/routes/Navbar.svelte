<script lang="ts">
	import '../app.css';
	import { createEventDispatcher } from 'svelte';
	import MenuIcon from '$lib/icons/menu.svg?raw';

	const dispatch = createEventDispatcher<{
		'toggle-drawer': null;
	}>();

	function toggleDrawer() {
		dispatch('toggle-drawer');
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
	<!-- <div>
		<button class="btn" on:click={handleNewWorkoutDialogOpen}>{@html AddIcon} Workout</button>
	</div> -->
</div>
