<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { userData } from '$lib/firebase';
	import { getWorkoutNameValidationMsg } from '$lib/utils';

	interface Props {
		open?: boolean;
		newWorkoutName?: string;
		onSave?: (name: string) => void;
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		newWorkoutName = $bindable(''),
		onSave,
		onCancel
	}: Props = $props();

	let inputEle: HTMLInputElement;
	let validationMsg: string | undefined = $state();

	function handleSave() {
		validationMsg = getWorkoutNameValidationMsg(newWorkoutName, $userData?.workouts);

		if (!validationMsg) {
			onSave?.(newWorkoutName);
			open = false;
		}
	}

	function handleCancel() {
		validationMsg = undefined;
		newWorkoutName = '';
		open = false;
		onCancel?.();
	}

	function handleKeyDown(event: KeyboardEvent) {
		validationMsg = undefined;
		if (event.key === 'Enter') {
			event.preventDefault();
			handleSave();
		}
	}

	// Auto-focus input when opened
	$effect(() => {
		if (open && inputEle) {
			setTimeout(() => inputEle.focus(), 100);
		}
	});
</script>

<BottomSheet bind:open size="small" title="New Exercise" onClose={handleCancel}>
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-2">
			<input
				bind:this={inputEle}
				aria-label="Exercise Name"
				type="text"
				autocomplete="off"
				placeholder="e.g., Push ups"
				class="input input-bordered w-full"
				bind:value={newWorkoutName}
				onkeydown={handleKeyDown}
			/>
			{#if validationMsg}
				<p class="text-error text-sm">{validationMsg}</p>
			{/if}
		</div>

		<div class="flex gap-2">
			<button class="btn btn-ghost flex-1" onclick={handleCancel}>Cancel</button>
			<button class="btn btn-primary flex-1" onclick={handleSave}>Add Exercise</button>
		</div>
	</div>
</BottomSheet>
