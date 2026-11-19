<script lang="ts">
	import { counted } from '$lib/utils';
	import { training } from '$lib/logic/training.svelte';
	import { HAPTIC } from '$lib/haptic';
	import { toaster } from '$lib/toast.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';

	/**
	 * Ending a workout early. Finish asks first, and offers to discard instead;
	 * discarding deletes sets, so it's never one tap: this asks again, saying
	 * exactly what goes.
	 */

	interface Props {
		/** The finish dialog; the screen opens it with `showModal()`. */
		finishDialog: HTMLDialogElement;
		/**
		 * "2 of 5 exercises", taken when the dialog opens: finishing clears the
		 * session while the dialog is still fading out, and live values would
		 * read "0 of 0".
		 */
		progress: string;
		onFinish: () => void;
	}

	let { finishDialog = $bindable(), progress, onFinish }: Props = $props();

	let discardDialog = $state<HTMLDialogElement>()!;
	let setsToDiscard = $state(0);

	function requestDiscard() {
		setsToDiscard = training.loggedSets.reduce((n, e) => n + e.sets.length, 0);
		discardDialog?.showModal();
	}

	function discard() {
		HAPTIC.heavy();
		// Gone from the store at once; the "ended elsewhere" redirect then
		// takes this screen down to Train.
		training.discard();
		toaster.show({ type: 'info', message: 'Workout discarded', timeout: 2500 });
	}
</script>

<ConfirmationDialog
	bind:dialog={finishDialog}
	header="Finish workout early?"
	content="{progress} done. Your sets are saved, and it's added to your history."
	actionLabel="Finish"
	secondaryLabel="Discard workout"
	onclose={(e) => {
		const choice = (e.target as HTMLDialogElement).returnValue;
		if (choice === 'default') onFinish();
		else if (choice === 'secondary') requestDiscard();
	}}
/>

<ConfirmationDialog
	bind:dialog={discardDialog}
	destructive
	header="Discard this workout?"
	content={setsToDiscard
		? `The ${counted(setsToDiscard, 'set')} you logged will be deleted and it won't be added to your history. This can't be undone.`
		: "Nothing's been logged yet, so there's nothing to lose."}
	actionLabel="Discard workout"
	cancelLabel="Keep workout"
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default') discard();
	}}
/>
