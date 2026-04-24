<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { type Routine } from '$lib/state.svelte';
	import { userData } from '$lib/firebase';
	import { getRoutineNameValidationMsg } from '$lib/utils';
	import DeleteIcon from '$lib/icons/delete.svg?raw';

	interface Props {
		open?: boolean;
		editingRoutine?: Routine;
		name?: string;
		onSave?: (name: string, timer?: { minutes: number; seconds: number }, notes?: string) => void;
		onDelete?: () => void;
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		editingRoutine,
		name = $bindable(''),
		onSave,
		onDelete,
		onCancel
	}: Props = $props();

	let inputEle: HTMLInputElement = $state()!;
	let editError: string | undefined = $state();
	let confirmingDelete = $state(false);

	let timerMinutes = $state(1);
	let timerSeconds = $state(30);
	let notes = $state('');
	let useCustomTimer = $state(false);

	const TIMER_PRESETS = [
		{ label: '0:30', m: 0, s: 30 },
		{ label: '1:00', m: 1, s: 0 },
		{ label: '1:30', m: 1, s: 30 },
		{ label: '2:00', m: 2, s: 0 },
		{ label: '2:30', m: 2, s: 30 },
		{ label: '3:00', m: 3, s: 0 },
		{ label: '3:30', m: 3, s: 30 },
		{ label: '5:00', m: 5, s: 0 }
	];

	let timerPreview = $derived(`${timerMinutes}:${timerSeconds < 10 ? '0' : ''}${timerSeconds}`);

	function handleSave() {
		editError = getRoutineNameValidationMsg(
			name,
			$userData?.routines?.filter((r) => r.id !== editingRoutine?.id)
		);

		if (!editError) {
			const timer = useCustomTimer ? { minutes: timerMinutes, seconds: timerSeconds } : undefined;
			onSave?.(name, timer, notes.trim() || undefined);
			open = false;
			confirmingDelete = false;
		}
	}

	function handleDelete() {
		onDelete?.();
		open = false;
		confirmingDelete = false;
	}

	function handleCancel() {
		editError = undefined;
		confirmingDelete = false;
		open = false;
		onCancel?.();
	}

	function handleDeleteClick() {
		confirmingDelete = true;
	}

	function handleCancelDelete() {
		confirmingDelete = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		editError = undefined;
		if (event.key === 'Enter') {
			event.preventDefault();
			handleSave();
		}
	}

	// Set name when editingRoutine changes
	$effect(() => {
		if (editingRoutine) {
			name = editingRoutine.name;
			notes = editingRoutine.notes ?? '';
			if (editingRoutine.timer) {
				useCustomTimer = true;
				timerMinutes = editingRoutine.timer.minutes;
				timerSeconds = editingRoutine.timer.seconds;
			} else {
				useCustomTimer = false;
				timerMinutes = $userData?.preferences?.timer?.minutes ?? 1;
				timerSeconds = $userData?.preferences?.timer?.seconds ?? 30;
			}
		}
	});

	// Auto-focus input when opened
	$effect(() => {
		if (open && inputEle && !confirmingDelete) {
			setTimeout(() => inputEle.focus(), 100);
		}
	});
</script>

<BottomSheet bind:open size="medium" title="Edit Routine" onClose={handleCancel}>
	<div class="flex flex-col gap-4">
		{#if confirmingDelete}
			<div class="flex flex-col items-center gap-3 py-2 text-center">
				<div
					class="bg-error/10 text-error flex items-center justify-center rounded-full p-3 [&>svg]:h-6 [&>svg]:w-6"
				>
					{@html DeleteIcon}
				</div>
				<div>
					<p class="font-semibold">Delete "{editingRoutine?.name}"?</p>
					<p class="text-base-content/50 mt-1 text-sm">Your exercises won't be affected.</p>
				</div>
			</div>

			<div class="flex gap-2">
				<button class="btn btn-ghost flex-1" onclick={handleCancelDelete}>Cancel</button>
				<button class="btn btn-error flex-1" onclick={handleDelete}>Delete</button>
			</div>
		{:else}
			<!-- Name -->
			<div class="flex flex-col gap-1.5">
				<label class="text-base-content/60 text-sm font-medium" for="edit-routine-name">Name</label>
				<input
					id="edit-routine-name"
					bind:this={inputEle}
					aria-label="Routine Name"
					type="text"
					autocomplete="off"
					class="input input-bordered w-full"
					bind:value={name}
					onkeydown={handleKeyDown}
				/>
				{#if editError}
					<p class="text-error px-0.5 text-xs">{editError}</p>
				{/if}
			</div>

			<!-- Notes -->
			<div class="flex flex-col gap-1.5">
				<label class="text-base-content/60 text-sm font-medium" for="edit-routine-notes"
					>Notes</label
				>
				<textarea
					id="edit-routine-notes"
					class="textarea textarea-bordered w-full resize-none text-sm"
					rows="2"
					placeholder="Optional notes for this routine…"
					bind:value={notes}
				></textarea>
			</div>

			<!-- Rest Timer -->
			<div class="flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-base-content/60 text-sm font-medium">Rest Timer</p>
						<p class="text-base-content/40 text-xs">
							{useCustomTimer ? 'Custom for this routine' : 'Uses global preference'}
						</p>
					</div>
					<div class="flex items-center gap-2">
						{#if useCustomTimer}
							<span class="text-primary text-xl font-black tabular-nums">{timerPreview}</span>
						{/if}
						<input
							type="checkbox"
							class="toggle toggle-primary toggle-sm"
							bind:checked={useCustomTimer}
						/>
					</div>
				</div>

				{#if useCustomTimer}
					<div class="flex flex-col gap-2">
						<!-- Presets -->
						<div class="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
							{#each TIMER_PRESETS as preset}
								<button
									type="button"
									class="btn btn-xs flex-none transition-colors"
									class:btn-primary={timerMinutes === preset.m && timerSeconds === preset.s}
									class:btn-ghost={timerMinutes !== preset.m || timerSeconds !== preset.s}
									onclick={() => {
										timerMinutes = preset.m;
										timerSeconds = preset.s;
									}}>{preset.label}</button
								>
							{/each}
						</div>
						<!-- Fine-tune -->
						<div class="flex items-center gap-3">
							<div class="flex flex-1 items-center gap-2">
								<input
									type="number"
									class="input input-bordered input-sm w-full text-center"
									bind:value={timerMinutes}
									min="0"
									max="59"
									onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
								/>
								<span class="text-base-content/50 text-xs">min</span>
							</div>
							<span class="text-base-content/30 font-bold">:</span>
							<div class="flex flex-1 items-center gap-2">
								<input
									type="number"
									class="input input-bordered input-sm w-full text-center"
									bind:value={timerSeconds}
									min={timerMinutes === 0 ? 1 : 0}
									max="59"
									onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
								/>
								<span class="text-base-content/50 text-xs">sec</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<div class="flex gap-2">
				<button class="btn btn-ghost text-error flex-1 gap-1.5" onclick={handleDeleteClick}>
					<span class="[&>svg]:h-4 [&>svg]:w-4">{@html DeleteIcon}</span>
					Delete
				</button>
				<button class="btn btn-primary flex-1" onclick={handleSave}>Save</button>
			</div>
		{/if}
	</div>
</BottomSheet>
