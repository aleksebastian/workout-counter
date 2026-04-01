<script lang="ts">
	import Dialog from '$lib/components/Dialog/Dialog.svelte';
	import DialogHeader from '$lib/components/Dialog/DialogHeader.svelte';
	import DialogAction from '$lib/components/Dialog/DialogAction.svelte';
	import { userData } from '$lib/firebase';
	import { getProgramNameValidationMsg } from '$lib/utils';

	interface Props {
		dialog: HTMLDialogElement;
		inputEle: HTMLInputElement;
		newProgramName: string;
		onclose: (event: Event) => void;
	}

	let {
		dialog = $bindable(),
		inputEle = $bindable(),
		newProgramName = $bindable(),
		onclose
	}: Props = $props();

	let validationMsg: string | undefined = $state();

	function validate(): string | undefined {
		return getProgramNameValidationMsg(newProgramName, $userData?.programs);
	}

	function handleKeyDown(event: KeyboardEvent) {
		validationMsg = undefined;
		if (event.key === 'Enter') {
			event.preventDefault();
			validationMsg = validate();
			if (!validationMsg) {
				dialog.returnValue = 'add';
				dialog.close();
			}
		}
	}

	function handleAddClick(event: MouseEvent) {
		validationMsg = validate();
		if (validationMsg) event.preventDefault();
	}

	function handleClose(e: any) {
		validationMsg = undefined;
		onclose(e);
	}
</script>

<Dialog bind:dialog onclose={handleClose}>
	<DialogHeader header="New Program" closeButton />

	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label class="text-base-content/60 text-sm font-medium" for="new-session-name">Name</label>
			<input
				id="new-session-name"
				bind:this={inputEle}
				aria-label="Session Name"
				type="text"
				class="input input-bordered w-full"
				bind:value={newProgramName}
				onkeydown={handleKeyDown}
				placeholder="e.g. Upper-Lower Split"
			/>
			<p class="text-base-content/40 text-xs">You'll add days and exercises after creating.</p>
		</div>
		<p class="text-error min-h-5 px-0.5 text-xs">{validationMsg ?? ''}</p>
	</div>

	<DialogAction noTopMargin>
		<button class="btn btn-primary w-full" value="add" onclick={handleAddClick}
			>Create Program</button
		>
	</DialogAction>
</Dialog>
