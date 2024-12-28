<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import Navbar from './Navbar.svelte';
	import Drawer from './Drawer.svelte';
	import { handleSignIn, handleSignOut } from '$lib/logic/auth';
	import { onMount } from 'svelte';
	import RestTimerToast from './RestTimerToast.svelte';
	import { add } from 'date-fns';
	import { userData } from '$lib/firebase';

	$: hasUser = $userData ? Object.hasOwn($userData, 'username') : false;

	$: if (!hasUser) {
		// handleSignOut();
	} else {
		const restTimerExpirationDate = localStorage.getItem('restTimerExpirationDate');

		if (restTimerExpirationDate) {
			expirationDate = new Date(restTimerExpirationDate);
			const now = new Date();
			if (now < expirationDate) {
				const diff = expirationDate.getTime() - now.getTime();
				restTime.minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
				restTime.seconds = Math.floor((diff % (1000 * 60)) / 1000);
				startTimer();
			}
		}
	}

	onMount(() => {
		document.addEventListener('startTimer', startTimer);

		return () => {
			if (restTimerHandle) clearInterval(restTimerHandle);
			document.removeEventListener('startTimer', startTimer);
		};
	});

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	let timer: string | undefined = undefined;
	$: originalRestTime = $userData?.preferences?.timer ?? {
		minutes: 1,
		seconds: 30
	};

	$: restTime = structuredClone(originalRestTime);

	function resetRestTime() {
		timer = undefined;
		restTimerHandle = undefined;
		restTime = structuredClone(originalRestTime);
	}

	let restTimerHandle: NodeJS.Timeout | undefined = undefined;
	let expirationDate: Date | undefined = undefined;

	function startTimer() {
		expirationDate = add(new Date(), { minutes: restTime.minutes, seconds: restTime.seconds });
		localStorage.setItem('restTimerExpirationDate', expirationDate.toISOString());

		if (restTimerHandle) {
			restTime = structuredClone(originalRestTime);
			stopTimer();
			startTimer();
			return;
		}

		restTimerHandle = setInterval(() => {
			const now = new Date();
			if (now >= expirationDate!) {
				timer = '0:00';
				setTimeout(() => {
					stopTimer();
				}, 450);
			} else {
				const diff = expirationDate!.getTime() - now.getTime();
				restTime.minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
				restTime.seconds = Math.floor((diff % (1000 * 60)) / 1000);
				let seconds = restTime.seconds < 10 ? `0${restTime.seconds}` : restTime.seconds;
				timer = `${restTime.minutes}:${seconds}`;
			}
		}, 1000);
	}

	function stopTimer() {
		clearInterval(restTimerHandle);
		resetRestTime();
	}

	let isDrawerOpen = false;
	function handleDrawerToggle() {
		isDrawerOpen = !isDrawerOpen;
	}
</script>

<svelte:head>
	<title>SetCount</title>
	<meta name="description" content="The best way to keep track of your workouts" />
</svelte:head>

<Navbar
	{hasUser}
	{isDrawerOpen}
	on:toggle-drawer={handleDrawerToggle}
	on:sign-in={handleSignIn}
	on:sign-out={handleSignOut}
/>

<Drawer bind:open={isDrawerOpen}>
	<div class="mx-auto p-4">
		<slot />
		{#if timer}
			<div class="toast">
				<RestTimerToast {timer} />
			</div>
		{/if}
	</div>
</Drawer>

<style>
	:global(.navbar) {
		view-transition-name: header;
	}

	:global(.drawer-side) {
		view-transition-name: drawer;
	}

	.toast {
		view-transition-name: toast;
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
