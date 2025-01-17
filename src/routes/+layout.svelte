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

	function resetRestTime() {
		restTimer.value = undefined;
		restTimerHandle = undefined;
		restTime = structuredClone(originalRestTime);
	}

	let restTimerHandle: NodeJS.Timeout | undefined = undefined;
	let expirationDate: Date | undefined = $state(undefined);

	async function startTimer() {
		toaster.addToast({
			id: 'rest',
			type: 'rest',
			message: 'Rest timer restarted'
		});
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
				restTimer.value = '0:00';
				setTimeout(() => {
					stopTimer();
				}, 450);
			} else {
				const diff = expirationDate!.getTime() - now.getTime();
				restTime.minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
				restTime.seconds = Math.floor((diff % (1000 * 60)) / 1000);
				let seconds = restTime.seconds < 10 ? `0${restTime.seconds}` : restTime.seconds;
				restTimer.value = `${restTime.minutes}:${seconds}`;
			}
		}, 1000);
	}

	function stopTimer() {
		clearInterval(restTimerHandle);
		resetRestTime();
	}

	let isDrawerOpen = $state(false);
	function handleDrawerToggle() {
		isDrawerOpen = !isDrawerOpen;
	}
	let hasUser = $derived($userData ? Object.hasOwn($userData, 'username') : false);

	onMount(() => {
		if (hasUser) {
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
	});

	let originalRestTime = $derived(
		$userData?.preferences?.timer ?? {
			minutes: 1,
			seconds: 30
		}
	);
	let restTime: { minutes: number; seconds: number };

	$effect(() => {
		restTime = structuredClone(originalRestTime);
	});
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
