<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import Navbar from './Navbar.svelte';
	import Drawer from './Drawer.svelte';
	import { user, userData } from '$lib/firebase';
	import { workouts$ } from '$lib/store';
	import { auth } from '$lib/firebase';
	import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	let isDrawerOpen = false;

	function handleDrawerToggle() {
		isDrawerOpen = !isDrawerOpen;
	}

	async function signInWithGoogle() {
		const provider = new GoogleAuthProvider();
		try {
			// await signInWithRedirect(auth, provider);
			// const user = await getRedirectResult(auth);
			const user = await signInWithPopup(auth, provider);
		} catch (error) {
			console.error(error);
		}

		return user;
	}

	async function handleSignIn() {
		await signInWithGoogle();
	}

	async function handleSignOut() {
		await signOut(auth);
	}

	$: if ($user && $userData) {
		workouts$.set($userData.workouts);
	}
</script>

<svelte:head>
	<title>Workout Counter</title>
	<meta name="description" content="The best way to count your workouts' reps" />
</svelte:head>

<Navbar
	on:toggle-drawer={handleDrawerToggle}
	{isDrawerOpen}
	on:sign-in={handleSignIn}
	on:sign-out={handleSignOut}
/>

<Drawer bind:open={isDrawerOpen}>
	<div class="mx-auto p-4">
		<slot />
	</div>
</Drawer>

<style>
	:global(.navbar) {
		view-transition-name: header;
	}

	:global(.drawer-side) {
		view-transition-name: drawer;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}

	@keyframes fade-out {
		to {
			opacity: 0;
		}
	}

	@keyframes slide-from-right {
		from {
			transform: translateX(30px);
		}
	}

	@keyframes slide-to-left {
		to {
			transform: translateX(-30px);
		}
	}

	:root::view-transition-old(root) {
		animation:
			90ms cubic-bezier(0.4, 0, 1, 1) both fade-out,
			300ms cubic-bezier(0.4, 0, 0.2, 1) both slide-to-left;
	}

	:root::view-transition-new(root) {
		animation:
			210ms cubic-bezier(0, 0, 0.2, 1) 90ms both fade-in,
			300ms cubic-bezier(0.4, 0, 0.2, 1) both slide-from-right;
	}
</style>
