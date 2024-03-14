<script lang="ts">
	import '../app.css';
	import NewWorkoutModal from './NewWorkoutModal.svelte';
	import AddIcon from '$lib/icons/add.svg?raw';

	export let isDrawerOpen: boolean;
	let isNewWorkoutModalOpen = false;
</script>

<div class="navbar flex items-center justify-between bg-base-100 p-4">
	<div>
		<button on:click={() => (isDrawerOpen = !isDrawerOpen)}>
			<label for="my-drawer-3" aria-label="open sidebar" class="btn btn-square btn-ghost">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					class="inline-block h-6 w-6 stroke-current"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
			</label>
		</button>
		<a class="btn btn-ghost text-xl" href="/">Workout Counter</a>
	</div>
	<div>
		<button class="btn" on:click={() => (isNewWorkoutModalOpen = true)}
			>{@html AddIcon} Workout</button
		>
	</div>
</div>

<NewWorkoutModal bind:open={isNewWorkoutModalOpen} />
