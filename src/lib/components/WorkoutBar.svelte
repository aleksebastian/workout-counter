<script lang="ts">
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { bottomSlot } from '$lib/logic/bottomSlot.svelte';
	import { training } from '$lib/logic/training.svelte';
	import Chevron from '$lib/components/Chevron.svelte';

	/**
	 * Shown while a workout is in progress and you're elsewhere in the app —
	 * the way back to it, in the rest timer's slot when no rest is running.
	 */

	let now = $state(Date.now());
	$effect(() => {
		if (!bottomSlot.showsWorkout) return;
		now = Date.now();
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});

	let elapsed = $derived.by(() => {
		const s = Math.max(0, Math.floor((now - (training.session?.startedAt ?? now)) / 1000));
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = (s % 60).toString().padStart(2, '0');
		return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${sec}` : `${m}:${sec}`;
	});

	let progress = $derived.by(() => {
		const total = training.plan?.length ?? 0;
		return total ? `${training.index + 1} of ${total}` : '';
	});
</script>

{#if bottomSlot.showsWorkout}
	<div
		class="fixed right-0 left-0 z-[550] px-3"
		style="bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 0.375rem)"
		in:fly={{ y: 72, duration: 280 }}
		out:fly={{ y: 72, duration: 200 }}
	>
		<button
			type="button"
			class="bg-base-200 border-base-300 hover:bg-base-300 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-xl transition-colors"
			aria-label="Resume {training.name || 'workout'}"
			onclick={() => goto('/train/run')}
		>
			<span class="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
				<span
					class="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
				></span>
				<span class="bg-primary relative inline-flex h-2.5 w-2.5 rounded-full"></span>
			</span>
			<span class="min-w-0 flex-1">
				<span class="block truncate text-sm font-semibold">{training.name || 'Workout'}</span>
				<span class="text-base-content/55 block text-xs tabular-nums">
					In progress · {elapsed}{progress ? ` · ${progress}` : ''}
				</span>
			</span>
			<span class="text-primary text-sm font-semibold">Resume</span>
			<Chevron class="text-primary h-4 w-4 shrink-0" />
		</button>
	</div>
{/if}
