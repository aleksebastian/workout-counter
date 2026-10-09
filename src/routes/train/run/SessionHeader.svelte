<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatClock } from '$lib/logic/training';
	import { pwa } from '$lib/logic/pwa.svelte';

	/**
	 * The run screen's own header, in place of the app navbar: minimize, what's
	 * running and for how long, and Finish.
	 */

	interface Props {
		title: string;
		/** Epoch ms; shows the elapsed clock when set. */
		startedAt?: number;
		/** Shows the Finish button when set. */
		onFinish?: () => void;
	}

	let { title, startedAt, onFinish }: Props = $props();

	let now = $state(Date.now());
	$effect(() => {
		if (startedAt === undefined) return;
		now = Date.now();
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});

	// Leaving doesn't end anything: the workout keeps running, and the bar
	// above the tabs is the way back.
	function minimize() {
		if (window.history.length > 1) {
			window.__backButtonClicked = true;
			window.history.back();
		} else {
			goto('/train');
		}
	}
</script>

<!-- Sticky, so Finish stays in reach on a long set list. Starts where the
     navbar would, below the status bar and any offline notice. -->
<header
	class="bg-base-100 sticky z-100 -mx-4 -mt-4 mb-2 grid grid-cols-[minmax(2.75rem,1fr)_minmax(0,auto)_minmax(2.75rem,1fr)] items-center gap-2 px-4 pb-2"
	style:top={pwa.online ? '0px' : '1.75rem'}
	style:margin-top={pwa.online ? undefined : '0.75rem'}
	style:padding-top="max(calc(1rem + env(safe-area-inset-top)), var(--app-inset-top))"
>
	<button
		class="btn btn-circle btn-ghost justify-self-start"
		onclick={minimize}
		aria-label="Minimize workout"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-6 w-6"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2.5"
			aria-hidden="true"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />
		</svg>
	</button>

	<div class="min-w-0 text-center">
		<p class="truncate text-base leading-tight font-bold">{title}</p>
		{#if startedAt !== undefined}
			<p
				class="text-base-content/55 mt-0.5 flex items-center justify-center gap-1.5 text-xs tabular-nums"
			>
				<span class="bg-primary h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden="true"></span>
				{formatClock(now - startedAt)} elapsed
			</p>
		{/if}
	</div>

	<div class="justify-self-end">
		{#if onFinish}
			<button
				class="btn btn-sm bg-primary/15 text-primary-strong hover:bg-primary/25 h-9 rounded-full border-none px-4 text-sm font-bold shadow-none"
				onclick={onFinish}>Finish</button
			>
		{/if}
	</div>
</header>
