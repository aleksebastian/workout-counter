<script lang="ts">
	import { holdRepeat } from '$lib/actions/holdRepeat';
	import { WEIGHT_STEP, bigWeightStep } from '$lib/constants';
	import { session } from '$lib/session.svelte';
	import NumberField from './NumberField.svelte';

	/**
	 * Reps and weight for the next set, side by side so the whole set reads as
	 * one thing and the card stays short enough to pin, each number with its
	 * steppers to its right. Steppers repeat while held; the numbers can be
	 * tapped to type an exact value. Steppers are 44pt tall, and 44pt wide from
	 * a 390pt screen up (40pt below, so a 375pt phone still fits both numbers):
	 * they're hit mid-workout, one-handed, often with chalk or sweat on the thumb.
	 */

	interface Props {
		reps: number;
		weight: number;
		/** A first set with no weight chosen yet: flagged, rather than read as bodyweight. */
		weightUnset?: boolean;
	}

	let { reps = $bindable(10), weight = $bindable(0), weightUnset = false }: Props = $props();

	let unit = $derived(session.prefs.weightUnit);
	let unitLabel = $derived(unit === 'kg' ? 'kg' : 'lb');
	let bigStep = $derived(bigWeightStep(unit));

	// Weight steps in 2.5 increments; round to one decimal so repeated taps
	// can't accumulate float drift into the stored value.
	const round = (n: number) => Math.round(n * 10) / 10;
	const clamp = (n: number, min: number) => (Number.isFinite(n) ? Math.max(min, n) : min);

	const stepWeight = (delta: number) => (weight = Math.max(0, round(weight + delta)));
</script>

{#snippet value(
	name: string,
	current: number,
	suffix: string,
	setValue: (n: number) => void,
	mode: 'numeric' | 'decimal'
)}
	<!-- Never squeezed: a clipped "10" reads as "1". -->
	<div class="flex shrink-0 items-baseline gap-1">
		<NumberField value={current} label={name} {mode} onchange={setValue} />
		{#if suffix}
			<span class="text-base-content/55 text-sm font-semibold">{suffix}</span>
		{/if}
	</div>
{/snippet}

{#snippet glyph(label: string, action: () => void, path: string)}
	<button
		class="btn btn-ghost hover:bg-base-300 h-11 min-h-0 w-10 rounded-full border-none px-0 shadow-none min-[390px]:w-11"
		use:holdRepeat={action}
		aria-label={label}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-4 w-4"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2.5"
			aria-hidden="true"><path stroke-linecap="round" d={path} /></svg
		>
	</button>
{/snippet}

<!-- − step + : the step size sits between its buttons. Reps leaves it out,
     since 1 goes without saying. -->
{#snippet stepper(
	name: string,
	delta: number,
	onDown: () => void,
	onUp: () => void,
	showStep = true
)}
	<div class="flex items-center">
		{@render glyph(`Decrease ${name} by ${delta}`, onDown, 'M5 12h14')}
		{#if showStep}
			<span class="text-base-content/60 w-6 text-center text-xs font-semibold tabular-nums"
				>{delta}</span
			>
		{/if}
		{@render glyph(`Increase ${name} by ${delta}`, onUp, 'M12 5v14M5 12h14')}
	</div>
{/snippet}

<div class="bg-base-200 flex flex-col rounded-2xl px-3 py-4">
	<div class="flex">
		<div class="flex min-w-0 flex-1 flex-col gap-1 pr-2.5">
			<span class="text-base-content/55 text-xs font-semibold tracking-widest uppercase">Reps</span>
			<div class="flex flex-1 items-center justify-between gap-1">
				{@render value('reps', reps, '', (n) => (reps = clamp(n, 0)), 'numeric')}
				{@render stepper(
					'reps',
					1,
					() => (reps = Math.max(1, reps - 1)),
					() => (reps += 1),
					false
				)}
			</div>
		</div>

		<div class="border-base-300 flex min-w-0 flex-[1.45] flex-col gap-1 border-l pl-2.5">
			<span class="text-base-content/55 truncate text-xs font-semibold tracking-widest uppercase"
				>Weight{#if weightUnset}
					<span class="text-warning tracking-normal normal-case"> · not set</span>
				{:else if weight === 0}
					<!-- Spelled out so an unchanged 0 is a choice, not a forgotten field. -->
					<span class="text-base-content/40 tracking-normal normal-case">
						· bodyweight</span
					>{/if}</span
			>
			<div class="flex flex-1 items-center justify-between gap-1">
				{@render value('weight', weight, unitLabel, (n) => (weight = clamp(n, 0)), 'decimal')}
				<div class="flex flex-col">
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
		</div>
	</div>
</div>
