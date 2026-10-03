<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import SetEntry from '$lib/components/SetEntry.svelte';
	import { session } from '$lib/session.svelte';
	import NotesIcon from '$lib/icons/notes.svg?raw';
	import DumbbellIcon from '$lib/icons/dumbbell-plus-minus.svg?raw';

	interface Props {
		open?: boolean;
		reps?: number;
		weight?: number;
		exerciseName?: string;
		onRecord: (reps: number, weight: number, notes: string, date: string) => void;
	}

	let {
		open = $bindable(false),
		reps = $bindable(10),
		weight = $bindable(0),
		exerciseName = '',
		onRecord
	}: Props = $props();

	let unit = $derived(session.prefs.weightUnit);

	function nowDatetimeLocal(): string {
		const now = new Date();
		const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
		return local.toISOString().slice(0, 16);
	}

	let notes = $state('');
	let date = $state(nowDatetimeLocal());
	let showDetails = $state(false);
	let notesInput = $state<HTMLInputElement>();

	$effect(() => {
		if (!open) {
			showDetails = false;
			notes = '';
			date = nowDatetimeLocal();
		}
	});

	$effect(() => {
		if (showDetails && notesInput) setTimeout(() => notesInput?.focus(), 50);
	});

	function record() {
		onRecord(reps, weight, notes, date ? new Date(date).toISOString() : new Date().toISOString());
		notes = '';
		date = nowDatetimeLocal();
		showDetails = false;
		open = false;
	}
</script>

<BottomSheet bind:open size="large" title={exerciseName || 'Record Set'}>
	{#snippet headerAction()}
		<button
			class="btn btn-ghost btn-sm relative gap-1.5 [&>svg]:h-4 [&>svg]:w-4"
			onclick={() => (showDetails = !showDetails)}
			aria-label={showDetails ? 'Back to reps and weight' : 'Add note and time'}
		>
			{#if showDetails}
				{@html DumbbellIcon}
				Reps &amp; Weight
			{:else}
				{@html NotesIcon}
				Notes &amp; Time
				{#if notes}
					<span class="badge badge-primary badge-xs absolute -top-0.5 -right-0.5"></span>
				{/if}
			{/if}
		</button>
	{/snippet}

	<div class="flex flex-col gap-4">
		{#if showDetails}
			<p class="text-base-content/50 text-sm">
				<strong class="text-base-content">{reps}</strong> reps
				{#if weight > 0}· <strong class="text-base-content">{weight}</strong> {unit}{/if}
			</p>

			<div class="flex flex-col gap-1.5">
				<label
					class="text-base-content/50 text-xs font-semibold tracking-widest uppercase"
					for="set-notes">Notes</label
				>
				<input
					id="set-notes"
					bind:this={notesInput}
					type="text"
					class="input input-bordered w-full"
					placeholder="e.g. felt heavy, PR, form off, easy…"
					bind:value={notes}
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<label
					class="text-base-content/50 text-xs font-semibold tracking-widest uppercase"
					for="set-date">Date &amp; Time</label
				>
				<input
					id="set-date"
					type="datetime-local"
					class="input input-bordered w-full"
					bind:value={date}
				/>
			</div>
		{:else}
			<SetEntry bind:reps bind:weight size="md" fadeClass="from-base-100" />
		{/if}

		<button class="btn btn-primary btn-lg w-full" onclick={record}>Record Set</button>
	</div>
</BottomSheet>
