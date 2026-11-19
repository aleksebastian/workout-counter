<script lang="ts">
	import { WEIGHT_STEP, bigWeightStep } from '$lib/constants';
	import { session } from '$lib/session.svelte';
	import NumberField from './NumberField.svelte';
	import StepperButton from './StepperButton.svelte';

	/**
	 * Reps and weight for the next set, side by side so the whole set reads as
	 * one thing and the card stays short enough to pin, each number with its
	 * steppers to its right. Steppers repeat while held; the numbers can be
	 * tapped to type an exact value. Steppers are 44pt tall and, where the card
	 * has room, 44pt wide: they're hit mid-workout, one-handed, often with chalk
	 * or sweat on the thumb.
	 *
	 * Sizes follow the card's own width, not the screen's: a sheet's wider
	 * gutters leave it less room than the session screen on the same phone.
	 * Under 22rem (352pt) the numbers drop two sizes, the steppers narrow to
	 * 36pt and the reps column takes only what it needs, so 12 × 102.5 still
	 * fits on a 375pt phone; NumberField shrinks a long weight a little more
	 * under 23rem.
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
		<NumberField value={current} label={name} {mode} onchange={setValue} fit />
		{#if suffix}
			<span class="text-base-content/55 text-sm font-semibold">{suffix}</span>
		{/if}
	</div>
{/snippet}

<!-- − step + : the step size sits between its buttons. Reps leaves it out,
     since 1 goes without saying, and keeps its pair compact: at 44pt its − sat
     far from the number and its + ran up against the divider, reading as the
     weight's. -->
{#snippet stepper(
	name: string,
	delta: number,
	onDown: () => void,
	onUp: () => void,
	showStep = true
)}
	<!-- The step label is selection-proof too: a hold on a button beside it
	     otherwise selects it. -->
	<div class="flex items-center select-none [-webkit-touch-callout:none]">
		<StepperButton
			label={`Decrease ${name} by ${delta}`}
			kind="decrease"
			action={onDown}
			compact={!showStep}
		/>
		{#if showStep}
			<span
				class="text-base-content/60 w-5 text-center text-xs font-semibold tabular-nums @min-[22rem]:w-6"
				>{delta}</span
			>
		{/if}
		<StepperButton
			label={`Increase ${name} by ${delta}`}
			kind="increase"
			action={onUp}
			compact={!showStep}
		/>
	</div>
{/snippet}

<!-- A size container: the steppers and numbers size to the card. -->
<div class="@container">
	<div
		data-testid="set-card"
		class="bg-base-200 flex flex-col rounded-2xl px-2 py-4 @min-[22rem]:px-3"
	>
		<div class="flex">
			<div
				data-testid="reps-column"
				class="flex min-w-0 flex-none flex-col gap-1 pr-2.5 @min-[22rem]:flex-1"
			>
				<span class="text-base-content/55 text-xs font-semibold tracking-widest uppercase"
					>Reps</span
				>
				<!-- The steppers sit right after the number, not against the divider,
				     so they read as the reps' own rather than the weight's. -->
				<div class="flex flex-1 items-center gap-1">
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

			<div
				data-testid="weight-column"
				class="border-base-300 flex min-w-0 flex-1 flex-col gap-1 border-l pl-2.5 @min-[22rem]:flex-[1.45]"
			>
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
</div>
