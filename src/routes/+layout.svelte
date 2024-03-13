<script lang="ts">
	import { onMount } from 'svelte';
	import Navbar from './Navbar.svelte';
	import { workouts$ } from '$lib/store';
	import Drawer from './Drawer.svelte';

	let isDrawerOpen = false;

	onMount(() => {
		const workouts = localStorage.getItem('workouts');
		if (workouts) {
			$workouts$ = JSON.parse(workouts);
		}
	});
</script>

<Navbar bind:isDrawerOpen />

<Drawer bind:isDrawerOpen>
	<div class="prose mx-auto p-4">
		<slot />
	</div>
</Drawer>

<style>
	:global(.drawer-side) {
		margin-top: 80px;
	}
</style>
