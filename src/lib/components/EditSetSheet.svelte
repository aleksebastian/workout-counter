<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { userData } from '$lib/firebase';

	interface Props {
		open?: boolean;
		reps?: number;
		weight?: number;
		onSave?: (reps: number, weight: number) => void;
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		reps = $bindable(0),
		weight = $bindable(0),
		onSave,
		onCancel
	}: Props = $props();

	let inputEle: HTMLInputElement;
	let weightUnit = $derived($userData?.preferences?.weightUnit ?? 'lbs');

	function handleSave() {
		onSave?.(reps, weight);
		open = false;
	}

	function handleCancel() {
		open = false;
		onCancel?.();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleSave();
		}
	}

	// Auto-focus first input when opened
	$effect(() => {
		if (open && inputEle) {
			setTimeout(() => inputEle.focus(), 100);
		}
	});
</script>

<BottomSheet bind:open size="small" title="Edit Set" onClose={handleCancel}>
	<div class="flex flex-col gap-4">
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

		<div class="flex gap-2">
			<button class="btn btn-ghost flex-1" onclick={handleCancel}>Cancel</button>
			<button class="btn btn-primary flex-1" onclick={handleSave}>Save</button>
		</div>
	</div>
</BottomSheet>
