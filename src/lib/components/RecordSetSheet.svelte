<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { userData } from '$lib/firebase';
	import { HAPTIC } from '$lib/haptic';
	import AddIcon from '$lib/icons/add.svg?raw';
	import RemoveIcon from '$lib/icons/remove.svg?raw';

	interface Props {
		open?: boolean;
		reps?: number;
		weight?: number;
		exerciseName?: string;
		onRecord?: (reps: number, weight: number) => void;
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		reps = $bindable(10),
		weight = $bindable(0),
		exerciseName = '',
		onRecord,
		onCancel
	}: Props = $props();

	let weightUnit = $derived($userData?.preferences?.weightUnit ?? 'lbs');

	// ── Hold-to-repeat logic ────────────────────────────────────────────────────
	function createHoldHandler(action: () => void) {
		let holdTimeout: ReturnType<typeof setTimeout> | undefined;
		let holdInterval: ReturnType<typeof setInterval> | undefined;

		function start() {
			action();
			HAPTIC.tap();
			holdTimeout = setTimeout(() => {
				holdInterval = setInterval(() => {
					action();
					HAPTIC.tap();
				}, 100);
			}, 400);
		}

		function stop() {
			clearTimeout(holdTimeout);
			clearInterval(holdInterval);
		}

		return { start, stop };
	}

	const repsDown = createHoldHandler(() => (reps = Math.max(1, reps - 1)));
	const repsUp = createHoldHandler(() => (reps += 1));
	const weightDown = createHoldHandler(
		() => (weight = Math.max(0, Math.round((weight - 2.5) * 10) / 10))
	);
	const weightUp = createHoldHandler(() => (weight = Math.round((weight + 2.5) * 10) / 10));

	const QUICK_REPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 30];
	const QUICK_WEIGHTS_LBS = [
		2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 95,
		100, 115, 135, 155, 185, 225, 275, 315
	];
	const QUICK_WEIGHTS_KG = [
		2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110,
		120, 140
	];
	let quickWeights = $derived(weightUnit === 'kg' ? QUICK_WEIGHTS_KG : QUICK_WEIGHTS_LBS);

	function handleRecord() {
		onRecord?.(reps, weight);
		open = false;
	}

	function handleCancel() {
		open = false;
		onCancel?.();
	}
</script>

<BottomSheet bind:open size="large" title={exerciseName || 'Record Set'} onClose={handleCancel}>
	<div class="flex flex-col gap-5">
		<!-- Reps -->
		<div class="flex flex-col gap-2">
			<span class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">Reps</span>
			<div class="flex items-center gap-3">
				<button
					class="btn btn-circle btn-lg flex-none"
					onpointerdown={repsDown.start}
					onpointerup={repsDown.stop}
					onpointerleave={repsDown.stop}
					onpointercancel={repsDown.stop}
					aria-label="Decrease reps">{@html RemoveIcon}</button
				>
				<input
					type="number"
					inputmode="numeric"
					class="min-w-0 flex-1 [appearance:textfield] bg-transparent text-center text-5xl font-black tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
					bind:value={reps}
					onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
				/>
				<button
					class="btn btn-circle btn-lg flex-none"
					onpointerdown={repsUp.start}
					onpointerup={repsUp.stop}
					onpointerleave={repsUp.stop}
					onpointercancel={repsUp.stop}
					aria-label="Increase reps">{@html AddIcon}</button
				>
			</div>
			<div class="relative">
				<div class="scrollbar-none flex gap-2 overflow-x-auto pb-1">
					{#each QUICK_REPS as n}
						<button
							class="btn btn-sm flex-none transition-colors select-none"
							class:btn-primary={reps === n}
							class:btn-ghost={reps !== n}
							onclick={() => {
								reps = n;
								HAPTIC.tap();
							}}>{n}</button
						>
					{/each}
				</div>
				<div
					class="from-base-100 pointer-events-none absolute top-0 right-0 bottom-1 w-8 bg-linear-to-l to-transparent"
				></div>
			</div>
		</div>

		<div class="divider my-0"></div>

		<!-- Weight -->
		<div class="flex flex-col gap-2">
			<span class="text-base-content/50 text-xs font-semibold tracking-widest uppercase"
				>Weight ({weightUnit})</span
			>
			<div class="flex items-center gap-3">
				<button
					class="btn btn-circle btn-lg flex-none"
					onpointerdown={weightDown.start}
					onpointerup={weightDown.stop}
					onpointerleave={weightDown.stop}
					onpointercancel={weightDown.stop}
					aria-label="Decrease weight">{@html RemoveIcon}</button
				>
				<input
					type="number"
					inputmode="decimal"
					class="min-w-0 flex-1 [appearance:textfield] bg-transparent text-center text-5xl font-black tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
					bind:value={weight}
					min="0"
					onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
				/>
				<button
					class="btn btn-circle btn-lg flex-none"
					onpointerdown={weightUp.start}
					onpointerup={weightUp.stop}
					onpointerleave={weightUp.stop}
					onpointercancel={weightUp.stop}
					aria-label="Increase weight">{@html AddIcon}</button
				>
			</div>
			<div class="relative">
				<div class="scrollbar-none flex gap-2 overflow-x-auto pb-1">
					{#each quickWeights as n}
						<button
							class="btn btn-sm flex-none transition-colors select-none"
							class:btn-primary={weight === n}
							class:btn-ghost={weight !== n}
							onclick={() => {
								weight = n;
								HAPTIC.tap();
							}}>{n}</button
						>
					{/each}
				</div>
				<div
					class="from-base-100 pointer-events-none absolute top-0 right-0 bottom-1 w-8 bg-linear-to-l to-transparent"
				></div>
			</div>
		</div>

		<!-- Record button -->
		<button class="btn btn-primary btn-lg w-full" onclick={handleRecord}> Record Set </button>
	</div>
</BottomSheet>
