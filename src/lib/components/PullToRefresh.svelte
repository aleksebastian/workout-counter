<script lang="ts">
	import { HAPTIC } from '$lib/haptic';

	interface Props {
		onRefresh: () => void | Promise<void>;
		threshold?: number;
		children?: import('svelte').Snippet;
	}

	let { onRefresh, threshold = 72, children }: Props = $props();

	let pullY = $state(0);
	let isRefreshing = $state(false);
	let startY = 0;
	let isPulling = $state(false);
	let hasFiredHaptic = $state(false);

	function isAtTop() {
		return window.scrollY === 0;
	}

	function onTouchStart(e: TouchEvent) {
		if (!isAtTop()) return;
		startY = e.touches[0].clientY;
		isPulling = true;
		hasFiredHaptic = false;
	}

	function onTouchMove(e: TouchEvent) {
		if (!isPulling || isRefreshing) return;
		const dy = e.touches[0].clientY - startY;
		if (dy <= 0) {
			pullY = 0;
			return;
		}
		// Apply rubber-band resistance
		pullY = Math.min(dy * 0.45, threshold + 20);

		if (pullY >= threshold && !hasFiredHaptic) {
			HAPTIC.medium();
			hasFiredHaptic = true;
		}
	}

	async function onTouchEnd() {
		if (!isPulling) return;
		isPulling = false;

		if (pullY >= threshold) {
			isRefreshing = true;
			pullY = 48; // hold spinner position
			await onRefresh();
			await new Promise((r) => setTimeout(r, 500));
			isRefreshing = false;
		}

		pullY = 0;
	}
</script>

<div
	role="region"
	aria-label="Pull to refresh"
	class="relative"
	ontouchstart={onTouchStart}
	ontouchmove={onTouchMove}
	ontouchend={onTouchEnd}
>
	<!-- Pull indicator -->
	{#if pullY > 8 || isRefreshing}
		<div
			class="pointer-events-none absolute right-0 left-0 z-10 flex justify-center overflow-hidden transition-all"
			style="top: -{48 - Math.min(pullY, 48)}px; height: 48px;"
		>
			<div
				class="bg-base-300 flex h-10 w-10 items-center justify-center rounded-full shadow"
				style="opacity: {Math.min(pullY / threshold, 1)};"
			>
				{#if isRefreshing}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 transition-transform"
						style="transform: rotate({Math.min((pullY / threshold) * 180, 180)}deg);"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
					</svg>
				{/if}
			</div>
		</div>
	{/if}

	<div
		style="transform: translateY({Math.min(pullY, threshold + 20)}px); transition: {isPulling
			? 'none'
			: 'transform 0.3s ease'};"
	>
		{@render children?.()}
	</div>
</div>
