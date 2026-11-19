<script lang="ts">
	import { session } from '$lib/session.svelte';
	import { formatPace, fromMeters, toMeters } from '$lib/logic/measure';
	import NumberField from './NumberField.svelte';
	import StepperButton from './StepperButton.svelte';
	import type { Measure } from '$lib/types';

	/**
	 * The next set's numbers for an exercise measured by time, distance and
	 * time, or reps with a hold — what `SetAdjuster` is for reps and weight,
	 * in the same card. Time is minutes and seconds; distance is typed in the
	 * user's unit and kept in meters, with the pace worked out as you type.
	 */

	interface Props {
		measure: Exclude<Measure, 'reps'>;
		reps: number;
		seconds: number;
		meters: number;
		holdSeconds: number;
		/** The set as entered would be a personal record, e.g. a best pace. */
		record?: boolean;
	}

	let {
		measure,
		reps = $bindable(10),
		seconds = $bindable(0),
		meters = $bindable(0),
		holdSeconds = $bindable(5),
		record = false
	}: Props = $props();

	let unit = $derived(session.prefs.distanceUnit);
	let minutesPart = $derived(Math.floor(seconds / 60));
	let secondsPart = $derived(seconds % 60);
	let pace = $derived(measure === 'distance' ? formatPace(meters, seconds, unit) : '');

	const clamp = (n: number, min: number) => (Number.isFinite(n) ? Math.max(min, n) : min);
	const setTime = (m: number, s: number) =>
		(seconds = Math.max(0, Math.round(clamp(m, 0) * 60 + clamp(s, 0))));
</script>

<!-- A reps pair stays compact, right beside its number, as in SetAdjuster. -->
{#snippet stepper(
	name: string,
	step: string,
	onDown: () => void,
	onUp: () => void,
	compact = false
)}
	<div class="flex items-center">
		<StepperButton
			label={`Decrease ${name} by ${step}`}
			kind="decrease"
			action={onDown}
			{compact}
		/>
		<StepperButton label={`Increase ${name} by ${step}`} kind="increase" action={onUp} {compact} />
	</div>
{/snippet}

{#snippet label(text: string)}
	<span class="text-base-content/55 text-xs font-semibold tracking-widest uppercase">{text}</span>
{/snippet}

<!-- Minutes and seconds as one m:ss value, minutes stepping by one. -->
{#snippet time(name: string)}
	<div class="flex min-w-0 flex-1 flex-col gap-1">
		{@render label(name)}
		<div class="flex flex-1 items-center justify-between gap-1">
			<div class="flex shrink-0 items-baseline">
				<NumberField
					value={minutesPart}
					label="{name} minutes"
					mode="numeric"
					onchange={(m) => setTime(m, secondsPart)}
				/>
				<span class="text-3xl font-black">:</span>
				<NumberField
					value={secondsPart}
					label="{name} seconds"
					mode="numeric"
					digits={2}
					onchange={(s) => setTime(minutesPart, Math.min(59, s))}
				/>
			</div>
			{@render stepper(
				`${name.toLowerCase()}`,
				'1 minute',
				() => setTime(minutesPart - 1, secondsPart),
				() => setTime(minutesPart + 1, secondsPart)
			)}
		</div>
	</div>
{/snippet}

<!-- A size container: StepperButton sizes to the card. -->
<div class="@container">
	<div class="bg-base-200 flex flex-col gap-3 rounded-2xl px-3 py-4">
		{#if measure === 'time'}
			{@render time('Time')}
		{:else if measure === 'distance'}
			<div class="flex">
				<div class="flex min-w-0 flex-1 flex-col gap-1 pr-2.5">
					{@render label('Distance')}
					<div class="flex flex-1 items-baseline gap-1">
						<NumberField
							value={fromMeters(meters, unit)}
							label="distance"
							mode="decimal"
							onchange={(n) => (meters = toMeters(clamp(n, 0), unit))}
						/>
						<span class="text-base-content/55 text-sm font-semibold">{unit}</span>
					</div>
				</div>
				<div class="border-base-300 flex min-w-0 flex-[1.3] border-l pl-2.5">
					{@render time('Time')}
				</div>
			</div>
			{#if pace}
				<div class="bg-base-100 flex items-center gap-2 rounded-xl px-3 py-2">
					{@render label('Pace')}
					<span class="font-bold tabular-nums">{pace}</span>
					{#if record}
						<span class="badge badge-sm bg-primary/15 text-primary-strong ml-auto border-none"
							>PR pace</span
						>
					{/if}
				</div>
			{/if}
		{:else}
			<div class="flex">
				<div class="flex min-w-0 flex-1 flex-col gap-1 pr-2.5">
					{@render label('Reps')}
					<div class="flex flex-1 items-center gap-1">
						<NumberField
							value={reps}
							label="reps"
							mode="numeric"
							onchange={(n) => (reps = clamp(n, 0))}
						/>
						{@render stepper(
							'reps',
							'1',
							() => (reps = Math.max(1, reps - 1)),
							() => (reps += 1),
							true
						)}
					</div>
				</div>
				<div class="border-base-300 flex min-w-0 flex-1 flex-col gap-1 border-l pl-2.5">
					{@render label('Hold')}
					<div class="flex flex-1 items-center justify-between gap-1">
						<div class="flex shrink-0 items-baseline gap-1">
							<NumberField
								value={holdSeconds}
								label="hold seconds"
								mode="numeric"
								onchange={(n) => (holdSeconds = clamp(n, 0))}
							/>
							<span class="text-base-content/55 text-sm font-semibold">s</span>
						</div>
						{@render stepper(
							'hold',
							'1 second',
							() => (holdSeconds = Math.max(1, holdSeconds - 1)),
							() => (holdSeconds += 1)
						)}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
