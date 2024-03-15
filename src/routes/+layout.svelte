<script lang="ts">
	import { onMount } from 'svelte';
	import Navbar from './Navbar.svelte';
	import { isMobileDevice$, workouts$ } from '$lib/store';
	import Drawer from './Drawer.svelte';

	let isDrawerOpen = false;

	onMount(() => {
		$isMobileDevice$ = window.navigator.userAgent.toLowerCase().includes('mobi');
		const workouts = localStorage.getItem('workouts');
		if (workouts) {
			$workouts$ = JSON.parse(workouts);
		}
	});

	function handleDrawerToggle() {
		isDrawerOpen = !isDrawerOpen;
	}
</script>

<Navbar on:toggleDrawer={handleDrawerToggle} />

<Drawer bind:isDrawerOpen>
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
