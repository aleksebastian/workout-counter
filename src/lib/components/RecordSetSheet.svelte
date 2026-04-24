<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { userData } from '$lib/firebase';
	import { HAPTIC } from '$lib/haptic';
	import AddIcon from '$lib/icons/add.svg?raw';
	import RemoveIcon from '$lib/icons/remove.svg?raw';
	import NotesIcon from '$lib/icons/notes.svg?raw';
	import DumbbellIcon from '$lib/icons/dumbbell-plus-minus.svg?raw';

	interface Props {
		open?: boolean;
		reps?: number;
		weight?: number;
		exerciseName?: string;
		onRecord?: (reps: number, weight: number, notes: string, date: string) => void;
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

	function nowDatetimeLocal(): string {
		const now = new Date();
		const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
		return local.toISOString().slice(0, 16);
	}

	let notes = $state('');
	let date = $state(nowDatetimeLocal());
	let showNotesView = $state(false);
	let notesInput = $state<HTMLInputElement>();
	let outerEl = $state<HTMLDivElement>();
	let repsPanel = $state<HTMLDivElement>();
	let notesPanel = $state<HTMLDivElement>();

	// Animate container height by measuring the active panel each time the view switches
	$effect(() => {
		const activePanel = showNotesView ? notesPanel : repsPanel;
		if (!outerEl || !activePanel) return;
		outerEl.style.height = activePanel.scrollHeight + 'px';
	});

	$effect(() => {
		if (!open) {
			showNotesView = false;
			notes = '';
			date = nowDatetimeLocal();
		}
	});

	$effect(() => {
		if (showNotesView && notesInput) {
			setTimeout(() => notesInput?.focus(), 50);
		}
	});

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
		onRecord?.(reps, weight, notes, date ? new Date(date).toISOString() : new Date().toISOString());
		notes = '';
		date = nowDatetimeLocal();
		showNotesView = false;
		open = false;
	}

	function handleCancel() {
		notes = '';
		showNotesView = false;
		open = false;
		onCancel?.();
	}
</script>

<BottomSheet bind:open size="medium" title={exerciseName || 'Record Set'} onClose={handleCancel}>
	{#snippet headerAction()}
		{#if showNotesView}
			<button
				class="btn btn-ghost btn-sm gap-1.5 [&>svg]:h-4 [&>svg]:w-4"
				onclick={() => (showNotesView = false)}
				aria-label="Back to Reps & Weight"
			>
				{@html DumbbellIcon}
				Reps &amp; Weight
			</button>
		{:else}
			<button
				class="btn btn-ghost btn-sm relative gap-1.5 [&>svg]:h-4 [&>svg]:w-4"
				onclick={() => (showNotesView = true)}
				aria-label="Add note and time"
			>
				{@html NotesIcon}
				Notes &amp; Time
				{#if notes}
					<span class="badge badge-primary badge-xs absolute -top-0.5 -right-0.5"></span>
				{/if}
			</button>
		{/if}
	{/snippet}

	<!-- Outer container clips the sliding panels; height driven by JS for smooth animation -->
	<div
		bind:this={outerEl}
		class="relative overflow-hidden"
		style="transition: height 200ms ease-out;"
	>
		<!-- ── Reps / Weight panel ──────────────────────────────────────── -->
		<div
			bind:this={repsPanel}
			class="absolute top-0 right-0 left-0 flex w-full flex-col gap-3 transition-[transform,opacity] duration-200 ease-out"
			inert={showNotesView}
			style:transform={showNotesView ? 'translateX(-16px)' : 'translateX(0)'}
			style:opacity={showNotesView ? '0' : '1'}
		>
			<!-- Reps -->
			<div class="flex flex-col gap-1.5">
				<span class="text-base-content/50 text-xs font-semibold tracking-widest uppercase"
					>Reps</span
				>
				<div class="flex items-center gap-3">
					<button
						class="btn btn-circle flex-none"
						onpointerdown={repsDown.start}
						onpointerup={repsDown.stop}
						onpointerleave={repsDown.stop}
						onpointercancel={repsDown.stop}
						aria-label="Decrease reps">{@html RemoveIcon}</button
					>
					<input
						type="number"
						inputmode="numeric"
						class="min-w-0 flex-1 [appearance:textfield] bg-transparent text-center text-4xl font-black tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						bind:value={reps}
						onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
					/>
					<button
						class="btn btn-circle flex-none"
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

			<!-- Weight -->
			<div class="flex flex-col gap-1.5">
				<span class="text-base-content/50 text-xs font-semibold tracking-widest uppercase"
					>Weight ({weightUnit})</span
				>
				<div class="flex items-center gap-3">
					<button
						class="btn btn-circle flex-none"
						onpointerdown={weightDown.start}
						onpointerup={weightDown.stop}
						onpointerleave={weightDown.stop}
						onpointercancel={weightDown.stop}
						aria-label="Decrease weight">{@html RemoveIcon}</button
					>
					<input
						type="number"
						inputmode="decimal"
						class="min-w-0 flex-1 [appearance:textfield] bg-transparent text-center text-4xl font-black tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						bind:value={weight}
						min="0"
						onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
					/>
					<button
						class="btn btn-circle flex-none"
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

		<!-- ── Notes panel ───────────────────────────────────────────────── -->
		<div
			bind:this={notesPanel}
			class="absolute top-0 right-0 left-0 flex w-full flex-col gap-3 transition-[transform,opacity] duration-200 ease-out"
			inert={!showNotesView}
			style:transform={showNotesView ? 'translateX(0)' : 'translateX(16px)'}
			style:opacity={showNotesView ? '1' : '0'}
		>
			<!-- Summary line -->
			<p class="text-base-content/50 text-sm">
				<strong class="text-base-content">{reps}</strong> reps
				{#if weight > 0}· <strong class="text-base-content">{weight}</strong> {weightUnit}{/if}
			</p>

			<!-- Notes -->
			<div class="flex flex-col gap-1.5">
				<span class="text-base-content/50 text-xs font-semibold tracking-widest uppercase"
					>Notes</span
				>
				<input
					bind:this={notesInput}
					type="text"
					class="input input-bordered w-full"
					placeholder="e.g. felt heavy, PR, form off, easy…"
					bind:value={notes}
				/>
			</div>

			<!-- Date / time -->
			<div class="flex flex-col gap-1.5">
				<span class="text-base-content/50 text-xs font-semibold tracking-widest uppercase"
					>Date &amp; Time</span
				>
				<input type="datetime-local" class="input input-bordered w-full" bind:value={date} />
			</div>

			<!-- Record button -->
			<button class="btn btn-primary btn-lg w-full" onclick={handleRecord}>Record Set</button>
		</div>
	</div>
</BottomSheet>
