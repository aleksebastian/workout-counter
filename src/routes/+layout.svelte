<script lang="ts">
	import Navbar from './Navbar.svelte';
	import Drawer from './Drawer.svelte';

	let isDrawerOpen = false;

	function handleDrawerToggle() {
		isDrawerOpen = !isDrawerOpen;
	}
</script>

<svelte:head>
	<title>Workout Counter</title>
	<meta name="description" content="The best way to count your workouts' reps" />
</svelte:head>

<Navbar on:toggle-drawer={handleDrawerToggle} />

<Drawer bind:open={isDrawerOpen}>
	<div class=" mx-auto p-4">
		<slot />
	</div>
</Drawer>

<style>
	:global(svg) {
		@media (prefers-color-scheme: dark) {
			fill: oklch(var(--bc));
		}
	}
</style>
