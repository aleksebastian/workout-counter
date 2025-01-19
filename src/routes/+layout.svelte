<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import Navbar from './Navbar.svelte';
	import Drawer from './Drawer.svelte';
	import { handleSignIn, handleSignOut } from '$lib/logic/auth';
	import { onMount } from 'svelte';
	import { add } from 'date-fns';
	import { userData } from '$lib/firebase';
	import Toasts from '$lib/components/Toasts.svelte';
	import { restTimer, toaster } from '$lib/state.svelte';

	interface Props {
		children?: import('svelte').Snippet;
	}
	let { children }: Props = $props();

	let defaultRestTime: { minutes: number; seconds: number };
	let restTime: { minutes: number; seconds: number };
	let hasUser = $derived($userData ? Object.hasOwn($userData, 'username') : false);
	const localStorageKey = 'workout-counter-rest-timer';

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

	let hasInitialized = false;
	$effect(() => {
		if (hasUser) {
			if ($userData!.preferences?.timer) {
				defaultRestTime = $userData!.preferences.timer;
				restTime = structuredClone(defaultRestTime);
			}

			if (hasInitialized) return;

			initialize();
			hasInitialized = true;
		}
	});

	function initialize() {
		const restTimerExpirationDate = localStorage.getItem(localStorageKey);
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

	async function startTimer() {
		toaster.addToast({
			id: 'rest',
			type: 'rest',
			message: 'Rest timer restarted'
		});

		expirationDate = add(new Date(), { minutes: restTime.minutes, seconds: restTime.seconds });
		localStorage.setItem(localStorageKey, expirationDate.toISOString());

		if (restTimerHandle) {
			restTime = structuredClone(defaultRestTime);
			stopTimer();
			startTimer();
			return;
		}

		restTimerHandle = setInterval(() => {
			const now = new Date();
			if (now >= expirationDate!) {
				restTimer.value = '0:00';
				setTimeout(() => {
					stopTimer();
				}, 450);
			} else {
				const diff = expirationDate!.getTime() - now.getTime();
				restTime.minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
				restTime.seconds = Math.floor((diff % (1000 * 60)) / 1000);
				const seconds = restTime.seconds < 10 ? `0${restTime.seconds}` : restTime.seconds;
				restTimer.value = `${restTime.minutes}:${seconds}`;
			}
		}, 1000);
	}

	function stopTimer() {
		clearInterval(restTimerHandle);
		resetRestTime();
	}

	function resetRestTime() {
		restTimer.value = undefined;
		restTimerHandle = undefined;
		restTime = structuredClone(defaultRestTime);
	}

	let restTimerHandle: NodeJS.Timeout | undefined = undefined;
	let expirationDate: Date | undefined = undefined;

	let isDrawerOpen = $state(false);
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
	toggleDrawer={handleDrawerToggle}
	signIn={handleSignIn}
	signOut={handleSignOut}
/>

<Drawer bind:open={isDrawerOpen}>
	<div class="mx-auto p-4">
		{@render children?.()}
		<Toasts />
	</div>
</Drawer>

<style>
	:global(.navbar) {
		view-transition-name: header;
	}

	:global(.drawer-side) {
		view-transition-name: drawer;
	}

	:global(.toast) {
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
