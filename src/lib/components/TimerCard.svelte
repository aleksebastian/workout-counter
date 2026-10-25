<script lang="ts">
	import { formatSeconds } from '$lib/logic/measure';

	/**
	 * The stopwatch for a time or distance set: a ring filling toward the
	 * target, the time in the middle, and what to do next under it. It runs
	 * from the clock (see `setTimer`), so it keeps counting with the phone
	 * locked; it never stops by itself, and past the target it says by how much.
	 */

	interface Props {
		/** Seconds on the clock; `null` before it has started. */
		seconds: number | null;
		/** What a set should last, if the plan says. */
		target?: number;
		paused?: boolean;
		onPause: () => void;
		onResume: () => void;
		/** Type the time instead, for a set done away from the phone. */
		onManual: () => void;
	}

	let { seconds, target, paused = false, onPause, onResume, onManual }: Props = $props();

	const R = 52;
	const C = 2 * Math.PI * R;
	let fraction = $derived(seconds === null || !target ? 0 : Math.min(1, seconds / target));
	let over = $derived(seconds !== null && !!target && seconds > target);
</script>

<div class="bg-base-200 flex items-center gap-4 rounded-2xl px-4 py-3">
	<div class="relative h-28 w-28 shrink-0">
		<svg class="h-28 w-28" viewBox="0 0 120 120" aria-hidden="true">
			<circle cx="60" cy="60" r={R} fill="none" stroke-width="8" class="stroke-base-content/10" />
			{#if fraction > 0}
				<circle
					cx="60"
					cy="60"
					r={R}
					fill="none"
					stroke-width="8"
					stroke-linecap="round"
					stroke-dasharray="{fraction * C} {C}"
					transform="rotate(-90 60 60)"
					class="stroke-primary"
				/>
			{/if}
		</svg>
		<div class="absolute inset-0 flex flex-col items-center justify-center">
			<span
				class={[
					'text-2xl font-black tabular-nums',
					paused ? 'text-base-content/55' : 'text-primary'
				]}
				role="timer"
				aria-live="off">{formatSeconds(seconds ?? 0)}</span
			>
			{#if target}
				<span class="text-base-content/55 text-xs tabular-nums">
					{over && seconds !== null
						? `+${formatSeconds(seconds - target)}`
						: `of ${formatSeconds(target)}`}
				</span>
			{/if}
		</div>
	</div>

	<div class="flex min-w-0 flex-1 flex-col gap-2">
		<p class="text-base-content/55 text-xs">
			{seconds === null
				? 'Start when you do'
				: paused
					? 'Paused'
					: 'Keeps counting if you lock your phone'}
		</p>
		{#if seconds === null}
			<!-- Started from the main button, under the card. -->
		{:else if paused}
			<button class="btn btn-sm bg-base-100 border-none shadow-none" onclick={onResume}
				>Resume</button
			>
		{:else}
			<button class="btn btn-sm bg-base-100 border-none shadow-none" onclick={onPause}>Pause</button
			>
		{/if}
		<button class="text-primary-strong text-left text-sm font-semibold" onclick={onManual}
			>Enter time instead</button
		>
	</div>
</div>
