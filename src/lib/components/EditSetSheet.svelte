<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { userData } from '$lib/firebase';
	import DeleteIcon from '$lib/icons/delete.svg?raw';

	interface Props {
		open?: boolean;
		reps?: number;
		weight?: number;
		date?: string;
		notes?: string;
		onSave?: (reps: number, weight: number, date: string, notes: string) => void;
		onDelete?: () => void;
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		reps = $bindable(0),
		weight = $bindable(0),
		date = $bindable(''),
		notes = $bindable(''),
		onSave,
		onDelete,
		onCancel
	}: Props = $props();

	let inputEle: HTMLInputElement = $state()!;
	let weightUnit = $derived($userData?.preferences?.weightUnit ?? 'lbs');
	let confirmingDelete = $state(false);

	// Local datetime-local string (YYYY-MM-DDTHH:MM in local time)
	let localDatetime = $state('');

	$effect(() => {
		if (open && date) {
			localDatetime = toDatetimeLocal(date);
		}
	});

	function toDatetimeLocal(iso: string): string {
		const d = new Date(iso);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function handleSave() {
		const savedDate = localDatetime ? new Date(localDatetime).toISOString() : date;
		onSave?.(reps, weight, savedDate, notes);
		open = false;
	}

	function handleCancel() {
		confirmingDelete = false;
		open = false;
		onCancel?.();
	}

	function handleDelete() {
		onDelete?.();
		open = false;
		confirmingDelete = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleSave();
		}
	}

	// Reset confirm state when sheet closes
	$effect(() => {
		if (!open) confirmingDelete = false;
	});

	// Auto-focus first input when opened
	$effect(() => {
		if (open && inputEle && !confirmingDelete) {
			setTimeout(() => inputEle.focus(), 100);
		}
	});
</script>

<BottomSheet bind:open size="medium" title="Edit Set" onClose={handleCancel}>
	<div class="flex flex-col gap-4">
		{#if confirmingDelete}
			<div class="flex flex-col items-center gap-3 py-2 text-center">
				<div
					class="bg-error/10 text-error flex items-center justify-center rounded-full p-3 [&>svg]:h-6 [&>svg]:w-6"
				>
					{@html DeleteIcon}
				</div>
				<div>
					<p class="font-semibold">Delete this set?</p>
					<p class="text-base-content/50 mt-1 text-sm">This can't be undone.</p>
				</div>
			</div>
			<div class="flex gap-2">
				<button class="btn btn-ghost flex-1" onclick={() => (confirmingDelete = false)}
					>Cancel</button
				>
				<button class="btn btn-error flex-1" onclick={handleDelete}>Delete</button>
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-3">
				<div class="flex flex-col gap-1">
					<label class="text-sm font-medium" for="edit-reps">Reps</label>
					<input
						id="edit-reps"
						bind:this={inputEle}
						aria-label="Reps"
						class="input input-bordered w-full"
						type="number"
						bind:value={reps}
						onkeydown={handleKeyDown}
					/>
				</div>

				<div class="flex flex-col gap-1">
					<label class="text-sm font-medium" for="edit-weight">Weight ({weightUnit})</label>
					<input
						id="edit-weight"
						aria-label="Weight"
						class="input input-bordered w-full"
						type="number"
						placeholder="Optional"
						bind:value={weight}
						min="0"
						onkeydown={handleKeyDown}
					/>
				</div>
			</div>

			<div class="flex flex-col gap-1">
				<label class="text-sm font-medium" for="edit-datetime">Date &amp; Time</label>
				<input
					id="edit-datetime"
					class="input input-bordered w-full"
					type="datetime-local"
					bind:value={localDatetime}
				/>
			</div>

			<div class="flex flex-col gap-1">
				<label class="text-sm font-medium" for="edit-set-notes">Notes</label>
				<textarea
					id="edit-set-notes"
					class="textarea textarea-bordered w-full resize-none"
					rows="2"
					placeholder="Optional"
					bind:value={notes}
				></textarea>
			</div>

			<div class="flex gap-2">
				<button
					class="btn btn-ghost text-error flex-1 gap-1.5"
					onclick={() => (confirmingDelete = true)}
				>
					<span class="[&>svg]:h-4 [&>svg]:w-4">{@html DeleteIcon}</span>
					Delete
				</button>
				<button class="btn btn-primary flex-1" onclick={handleSave}>Save</button>
			</div>
		{/if}
	</div>
</BottomSheet>
