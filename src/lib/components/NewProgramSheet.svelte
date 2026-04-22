<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { userData } from '$lib/firebase';
	import { getProgramNameValidationMsg } from '$lib/utils';

	interface Props {
		open?: boolean;
		newProgramName?: string;
		onSave?: (name: string) => void;
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		newProgramName = $bindable(''),
		onSave,
		onCancel
	}: Props = $props();

	let inputEle: HTMLInputElement;
	let validationMsg: string | undefined = $state();

	function handleSave() {
		validationMsg = getProgramNameValidationMsg(newProgramName, $userData?.programs);

		if (!validationMsg) {
			onSave?.(newProgramName);
			open = false;
		}
	}

	function handleCancel() {
		validationMsg = undefined;
		newProgramName = '';
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

<BottomSheet bind:open size="small" title="New Program" onClose={handleCancel}>
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-2">
			<label class="text-base-content/60 text-sm font-medium" for="program-name">Name</label>
			<input
				id="program-name"
				bind:this={inputEle}
				aria-label="Program Name"
				type="text"
				autocomplete="off"
				placeholder="e.g., Upper-Lower Split"
				class="input input-bordered w-full"
				bind:value={newProgramName}
				onkeydown={handleKeyDown}
			/>
			<p class="text-base-content/40 text-xs">You'll add days and exercises after creating.</p>
			{#if validationMsg}
				<p class="text-error text-sm">{validationMsg}</p>
			{/if}
		</div>

		<div class="flex gap-2">
			<button class="btn btn-ghost flex-1" onclick={handleCancel}>Cancel</button>
			<button class="btn btn-primary flex-1" onclick={handleSave}>Create Program</button>
		</div>
	</div>
</BottomSheet>
