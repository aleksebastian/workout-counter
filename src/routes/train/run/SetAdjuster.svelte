<script lang="ts">
	import { holdRepeat } from '$lib/actions/holdRepeat';
	import { WEIGHT_STEP, bigWeightStep } from '$lib/constants';
	import { session } from '$lib/session.svelte';

	/**
	 * Reps and weight for the next set, side by side so the whole set reads as
	 * one thing and the card stays short enough to pin. Steppers repeat while
	 * held; the numbers can be tapped to type an exact value.
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
	// Sized to the number so the unit sits right after it. Digits are tabular
	// (1ch each); a decimal point is much narrower.
	function fieldWidth(n: number) {
		const text = String(n);
		const points = text.split('.').length - 1;
		return Math.max(1, text.length - points) + points * 0.35 + 0.15;
	}

	const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
</script>

{#snippet value(
	name: string,
	current: number,
	suffix: string,
	setValue: (n: number) => void,
	mode: 'numeric' | 'decimal'
)}
	<div class="flex min-w-0 items-baseline gap-1">
		<input
			type="number"
			inputmode={mode}
			aria-label={name}
			class="min-w-0 [appearance:textfield] bg-transparent text-4xl leading-none font-black tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
			style:width="{fieldWidth(current)}ch"
			value={current}
			min="0"
			oninput={(e) => setValue(Number((e.currentTarget as HTMLInputElement).value))}
			onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
		/>
		<span class="text-base-content/55 text-sm font-semibold">{suffix}</span>
	</div>
{/snippet}

<!-- A labelled step button: the step is printed on it, since there's no room
     for a caption between the buttons. -->
{#snippet step(name: string, delta: number, action: () => void)}
	<button
		class="btn bg-base-100 border-base-300 h-11 min-w-0 flex-1 rounded-xl px-0 text-sm font-semibold tabular-nums shadow-none"
		use:holdRepeat={action}
		aria-label="{delta < 0 ? 'Decrease' : 'Increase'} {name} by {Math.abs(delta)}"
		>{signed(delta)}</button
	>
{/snippet}

<div class="bg-base-200 flex flex-col rounded-2xl p-4">
	<div class="grid grid-cols-2">
		<div class="flex min-w-0 flex-col gap-1 pr-3">
			<span class="text-base-content/55 text-xs font-semibold tracking-widest uppercase">Reps</span>
			{@render value('reps', reps, 'reps', (n) => (reps = clamp(n, 0)), 'numeric')}
			<div class="mt-2 flex gap-1.5">
				{@render step('reps', -1, () => (reps = Math.max(1, reps - 1)))}
				{@render step('reps', 1, () => (reps += 1))}
			</div>
		</div>

		<div class="border-base-300 flex min-w-0 flex-col gap-1 border-l pl-3">
			<span class="text-base-content/55 truncate text-xs font-semibold tracking-widest uppercase"
				>Weight{#if weight === 0}
					<!-- Spelled out so an unchanged 0 is a choice, not a forgotten field. -->
					<span class="text-base-content/40 tracking-normal normal-case">
						· bodyweight</span
					>{/if}</span
			>
			{@render value('weight', weight, unitLabel, (n) => (weight = clamp(n, 0)), 'decimal')}
			<div class="mt-2 flex gap-1">
				{@render step('weight', -bigStep, () => stepWeight(-bigStep))}
				{@render step('weight', -WEIGHT_STEP, () => stepWeight(-WEIGHT_STEP))}
				{@render step('weight', WEIGHT_STEP, () => stepWeight(WEIGHT_STEP))}
				{@render step('weight', bigStep, () => stepWeight(bigStep))}
			</div>
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
