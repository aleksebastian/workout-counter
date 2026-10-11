<script lang="ts">
	import { holdRepeat } from '$lib/actions/holdRepeat';
	import { HAPTIC } from '$lib/haptic';
	import { QUICK_REPS, WEIGHT_STEP, quickWeights } from '$lib/constants';
	import { session } from '$lib/session.svelte';

	interface Props {
		reps: number;
		weight: number;
		/** Background the chip rows fade into — must match the parent surface. */
		fadeClass?: string;
	}

	let {
		reps = $bindable(10),
		weight = $bindable(0),
		fadeClass = 'from-base-100'
	}: Props = $props();

	let unit = $derived(session.prefs.weightUnit);
	let weights = $derived(quickWeights(unit));

	// Weight steps in 2.5 increments; round to one decimal so repeated taps
	// can't accumulate float drift into the stored value.
	const round = (n: number) => Math.round(n * 10) / 10;
	const clamp = (n: number, min: number) => (Number.isFinite(n) ? Math.max(min, n) : min);
</script>

{#snippet stepper(
	name: string,
	label: string,
	value: number,
	onDown: () => void,
	onUp: () => void,
	setValue: (n: number) => void,
	quick: number[],
	mode: 'numeric' | 'decimal'
)}
	<div class="flex flex-col gap-2">
		<span class="text-base-content/50 text-xs font-semibold tracking-widest uppercase"
			>{label}{#if name === 'weight' && value === 0}
				<!-- Spelled out so an unchanged 0 is a choice, not a forgotten field. -->
				<span class="text-base-content/40 tracking-normal normal-case">
					· none (bodyweight)</span
				>{/if}</span
		>
		<div class="flex items-center gap-3">
			<button class="btn btn-circle flex-none" use:holdRepeat={onDown} aria-label="Decrease {name}">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
					aria-hidden="true"><path stroke-linecap="round" d="M5 12h14" /></svg
				>
			</button>
			<input
				type="number"
				inputmode={mode}
				aria-label={name}
				class="min-w-0 flex-1 [appearance:textfield] bg-transparent text-center text-4xl font-black tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				{value}
				min="0"
				oninput={(e) => setValue(Number((e.currentTarget as HTMLInputElement).value))}
				onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
			/>
			<button class="btn btn-circle flex-none" use:holdRepeat={onUp} aria-label="Increase {name}">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
					aria-hidden="true"><path stroke-linecap="round" d="M12 5v14M5 12h14" /></svg
				>
			</button>
		</div>
		<div class="relative">
			<div class="flex scrollbar-none gap-2 overflow-x-auto pb-1">
				{#each quick as n, i (i)}
					<button
						class="btn btn-sm flex-none transition-colors select-none"
						class:btn-primary={value === n}
						class:btn-ghost={value !== n}
						onclick={() => {
							setValue(n);
							HAPTIC.tap();
						}}>{n}</button
					>
				{/each}
			</div>
			<div
				class="{fadeClass} pointer-events-none absolute top-0 right-0 bottom-1 w-8 bg-linear-to-l to-transparent"
			></div>
		</div>
	</div>
{/snippet}

<div class="flex flex-col gap-3">
	{@render stepper(
		'reps',
		'Reps',
		reps,
		() => (reps = Math.max(1, reps - 1)),
		() => (reps += 1),
		(n) => (reps = clamp(n, 0)),
		QUICK_REPS,
		'numeric'
	)}

	{@render stepper(
		'weight',
		`Weight (${unit})`,
		weight,
		() => (weight = Math.max(0, round(weight - WEIGHT_STEP))),
		() => (weight = round(weight + WEIGHT_STEP)),
		(n) => (weight = clamp(n, 0)),
		weights,
		'decimal'
	)}
</div>
