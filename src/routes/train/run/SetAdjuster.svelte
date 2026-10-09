<script lang="ts">
	import { holdRepeat } from '$lib/actions/holdRepeat';
	import { WEIGHT_STEP, bigWeightStep } from '$lib/constants';
	import { session } from '$lib/session.svelte';

	/**
	 * Reps and weight for the next set. Steppers repeat while held; the numbers
	 * can be tapped to type an exact value.
	 */

	interface Props {
		reps: number;
		weight: number;
		notes: string;
		showNotes: boolean;
	}

	let {
		reps = $bindable(10),
		weight = $bindable(0),
		notes = $bindable(''),
		showNotes
	}: Props = $props();

	let unit = $derived(session.prefs.weightUnit);
	let unitLabel = $derived(unit === 'kg' ? 'kg' : 'lb');
	let bigStep = $derived(bigWeightStep(unit));

	// Weight steps in 2.5 increments; round to one decimal so repeated taps
	// can't accumulate float drift into the stored value.
	const round = (n: number) => Math.round(n * 10) / 10;
	const clamp = (n: number, min: number) => (Number.isFinite(n) ? Math.max(min, n) : min);

	const stepWeight = (delta: number) => (weight = Math.max(0, round(weight + delta)));
</script>

{#snippet stepper(name: string, step: number, onDown: () => void, onUp: () => void)}
	<div class="flex items-center gap-1">
		<button
			class="btn btn-square bg-base-100 border-base-300 h-12 w-12 rounded-xl shadow-none"
			use:holdRepeat={onDown}
			aria-label="Decrease {name} by {step}"
		>
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
		<span class="text-base-content/60 w-9 text-center text-sm font-semibold tabular-nums"
			>{step}</span
		>
		<button
			class="btn btn-square bg-base-100 border-base-300 h-12 w-12 rounded-xl shadow-none"
			use:holdRepeat={onUp}
			aria-label="Increase {name} by {step}"
		>
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
{/snippet}

{#snippet value(
	name: string,
	current: number,
	suffix: string,
	setValue: (n: number) => void,
	mode: 'numeric' | 'decimal'
)}
	<div class="flex items-baseline gap-1.5">
		<input
			type="number"
			inputmode={mode}
			aria-label={name}
			class="[appearance:textfield] bg-transparent text-5xl leading-none font-black tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
			style:width="{Math.max(1, String(current).length) + 0.25}ch"
			value={current}
			min="0"
			oninput={(e) => setValue(Number((e.currentTarget as HTMLInputElement).value))}
			onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
		/>
		<span class="text-base-content/55 text-base font-semibold">{suffix}</span>
	</div>
{/snippet}

<div class="bg-base-200 flex flex-col rounded-2xl p-5">
	<div class="flex items-center justify-between gap-3">
		<div class="flex min-w-0 flex-col gap-1">
			<span class="text-base-content/55 text-xs font-semibold tracking-widest uppercase">Reps</span>
			{@render value('reps', reps, 'reps', (n) => (reps = clamp(n, 0)), 'numeric')}
		</div>
		{@render stepper(
			'reps',
			1,
			() => (reps = Math.max(1, reps - 1)),
			() => (reps += 1)
		)}
	</div>

	<hr class="border-base-300 my-4" />

	<div class="flex items-center justify-between gap-3">
		<div class="flex min-w-0 flex-col gap-1">
			<span class="text-base-content/55 text-xs font-semibold tracking-widest uppercase"
				>Weight{#if weight === 0}
					<!-- Spelled out so an unchanged 0 is a choice, not a forgotten field. -->
					<span class="text-base-content/40 tracking-normal normal-case">
						· bodyweight</span
					>{/if}</span
			>
			{@render value('weight', weight, unitLabel, (n) => (weight = clamp(n, 0)), 'decimal')}
		</div>
		<div class="flex flex-col gap-2">
			{@render stepper(
				'weight',
				WEIGHT_STEP,
				() => stepWeight(-WEIGHT_STEP),
				() => stepWeight(WEIGHT_STEP)
			)}
			{@render stepper(
				'weight',
				bigStep,
				() => stepWeight(-bigStep),
				() => stepWeight(bigStep)
			)}
		</div>
	</div>

	{#if showNotes}
		<input
			type="text"
			class="input bg-base-100 mt-4 w-full"
			placeholder="e.g. felt heavy, form off, easy…"
			aria-label="Set notes"
			bind:value={notes}
		/>
	{/if}
</div>
