<script lang="ts">
	import { onDestroy } from 'svelte';
	import { HAPTIC } from '$lib/haptic';

	/**
	 * Counts the holds of a reps-with-a-hold set: each rep is held for the set
	 * time, with a buzz as it ends and a short breath before the next, until the
	 * target reps are done. Holds are short and done with the screen on, so
	 * this one ticks in the page; `reps` follows the holds finished, ready to log.
	 */

	interface Props {
		holdSeconds: number;
		/** Reps the set aims for; it stops there. */
		targetReps: number;
		/** Holds finished so far — what "Log set" records. */
		reps: number;
		/** Type the numbers instead. */
		onManual: () => void;
	}

	let { holdSeconds, targetReps, reps = $bindable(0), onManual }: Props = $props();

	/** The breath between holds. */
	const RELAX_MS = 2000;

	let phase = $state<'idle' | 'hold' | 'relax' | 'done'>('idle');
	let paused = $state(false);
	let phaseStart = 0;
	let pausedAt = 0;
	let elapsed = $state(0);
	let tick: ReturnType<typeof setInterval> | null = null;

	const R = 44;
	const C = 2 * Math.PI * R;
	let holdMs = $derived(Math.max(1, holdSeconds) * 1000);
	let fraction = $derived(
		phase === 'hold' ? Math.min(1, elapsed / holdMs) : phase === 'done' ? 1 : 0
	);
	let shown = $derived(
		phase === 'hold' ? Math.min(holdSeconds, Math.floor(elapsed / 1000) + 1) : holdSeconds
	);

	function step() {
		if (paused) return;
		elapsed = performance.now() - phaseStart;
		if (phase === 'hold' && elapsed >= holdMs) {
			reps += 1;
			if (reps >= targetReps) {
				HAPTIC.success();
				phase = 'done';
				stop();
				return;
			}
			HAPTIC.medium();
			phase = 'relax';
			phaseStart = performance.now();
			elapsed = 0;
		} else if (phase === 'relax' && elapsed >= RELAX_MS) {
			phase = 'hold';
			phaseStart = performance.now();
			elapsed = 0;
		}
	}

	function stop() {
		if (tick) clearInterval(tick);
		tick = null;
	}

	function start() {
		HAPTIC.tap();
		if (phase === 'idle' || phase === 'done') reps = 0;
		phase = 'hold';
		paused = false;
		phaseStart = performance.now();
		elapsed = 0;
		stop();
		tick = setInterval(step, 100);
	}

	function togglePause() {
		HAPTIC.tap();
		if (paused) {
			phaseStart += performance.now() - pausedAt;
			paused = false;
		} else {
			pausedAt = performance.now();
			paused = true;
		}
	}

	onDestroy(stop);
</script>

<div class="bg-base-200 flex items-center gap-4 rounded-2xl px-4 py-3">
	<div class="relative h-24 w-24 shrink-0">
		<svg class="h-24 w-24" viewBox="0 0 100 100" aria-hidden="true">
			<circle cx="50" cy="50" r={R} fill="none" stroke-width="8" class="stroke-base-content/10" />
			{#if fraction > 0}
				<circle
					cx="50"
					cy="50"
					r={R}
					fill="none"
					stroke-width="8"
					stroke-linecap="round"
					stroke-dasharray="{fraction * C} {C}"
					transform="rotate(-90 50 50)"
					class="stroke-primary"
				/>
			{/if}
		</svg>
		<div class="absolute inset-0 flex flex-col items-center justify-center">
			<span class="text-primary text-2xl font-black tabular-nums" role="timer">{shown}</span>
			<span class="text-base-content/55 text-xs">of {holdSeconds}s</span>
		</div>
	</div>

	<div class="flex min-w-0 flex-1 flex-col gap-1.5">
		<p class="text-base-content/55 text-xs font-semibold tracking-widest uppercase">
			{phase === 'relax' ? 'Relax' : phase === 'done' ? 'Done' : 'Hold'}
		</p>
		<p class="text-xl font-black tabular-nums">
			Rep {phase === 'idle' ? 1 : Math.min(reps + (phase === 'done' ? 0 : 1), targetReps)}
			<span class="text-base-content/55 text-sm font-semibold">of {targetReps}</span>
		</p>
		<div class="flex items-center gap-3">
			{#if phase === 'idle' || phase === 'done'}
				<button class="btn btn-sm bg-base-100 border-none shadow-none" onclick={start}
					>{phase === 'done' ? 'Again' : 'Start'}</button
				>
			{:else}
				<button class="btn btn-sm bg-base-100 border-none shadow-none" onclick={togglePause}
					>{paused ? 'Resume' : 'Pause'}</button
				>
			{/if}
			<button class="text-primary-strong text-sm font-semibold" onclick={onManual}>Edit</button>
		</div>
	</div>
</div>
