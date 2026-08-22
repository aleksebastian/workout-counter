<script lang="ts">
	import { fly } from 'svelte/transition';
	import { restTimer } from '$lib/logic/restTimer.svelte';
</script>

{#if restTimer.active}
	<div
		class="fixed right-0 left-0 z-[550] px-3"
		style="bottom: calc(4rem + env(safe-area-inset-bottom, 0px) + 0.375rem); view-transition-name: rest-timer"
		in:fly={{ y: 72, duration: 280 }}
		out:fly={{ y: 72, duration: 200 }}
	>
		<div class="bg-base-200 border-base-300 overflow-hidden rounded-2xl border shadow-xl">
			<div class="flex items-center gap-4 px-4 py-3">
				<div class="min-w-0 flex-1">
					<p class="text-base-content/40 text-xs font-semibold tracking-widest uppercase">Rest</p>
					<!-- Naming the source makes the routine-over-default precedence visible,
					     rather than leaving the user to wonder why this rest is 2:00 today. -->
					<p class="text-base-content/55 mt-0.5 truncate text-xs">
						{restTimer.source ? `${restTimer.source} timer` : 'Next set coming up'}
					</p>
				</div>

				<span class="text-primary text-3xl font-black tabular-nums">{restTimer.display}</span>

				<button
					class="btn btn-circle btn-ghost btn-sm text-base-content/30"
					onclick={() => restTimer.stop()}
					aria-label="Dismiss rest timer"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="bg-base-content/10 h-1">
				<div
					class="bg-primary h-full transition-[width] duration-1000 ease-linear"
					style="width: {restTimer.progress}%"
				></div>
			</div>
		</div>
	</div>
{/if}
