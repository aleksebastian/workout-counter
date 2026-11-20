<script lang="ts">
	import type { Snippet } from 'svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { getNameValidationMsg } from '$lib/utils';

	/**
	 * The edit sheet for anything with a name and notes: an exercise, a routine
	 * or a program. Seeds both fields from `item` each time it opens, checks the
	 * name is there and not taken by another of its kind, then saves and closes.
	 * A sheet's own extra controls go in `children`, between the notes and Save.
	 */

	interface Props {
		open?: boolean;
		title: string;
		size: 'medium' | 'large';
		/** What the name check calls it: "Workout name missing", "Routine already exists". */
		kind: 'Workout' | 'Routine' | 'Program';
		/** Prefixes the fields' ids, so their labels stay tied to them. */
		idPrefix: string;
		item: { id: string; name: string; notes?: string } | null | undefined;
		/** Every item of its kind, this one included: a name only clashes with the others. */
		existing: { id: string; name: string }[] | null | undefined;
		notesPlaceholder: string;
		notesRows?: number;
		inputClass?: string;
		notesClass?: string;
		children?: Snippet;
		onSave: (name: string, notes: string) => void;
	}

	let {
		open = $bindable(false),
		title,
		size,
		kind,
		idPrefix,
		item,
		existing,
		notesPlaceholder,
		notesRows = 3,
		inputClass,
		notesClass,
		children,
		onSave
	}: Props = $props();

	let name = $state('');
	let notes = $state('');
	let error = $state<string | undefined>(undefined);

	// Seed the form from whichever item the sheet was opened for.
	$effect(() => {
		if (open && item) {
			name = item.name;
			notes = item.notes ?? '';
			error = undefined;
		}
	});

	function save() {
		error = getNameValidationMsg(
			kind,
			name,
			(existing ?? []).filter((other) => other.id !== item?.id)
		);
		if (error) return;
		onSave(name, notes);
		open = false;
	}
</script>

<BottomSheet bind:open {size} {title}>
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label class="text-base-content/70 text-sm font-medium" for="{idPrefix}-name">Name</label>
			<input
				id="{idPrefix}-name"
				type="text"
				autocomplete="off"
				class={['input input-bordered w-full', inputClass]}
				bind:value={name}
				oninput={() => (error = undefined)}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						save();
					}
				}}
			/>
			{#if error}
				<p class="text-error-strong px-0.5 text-xs">{error}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<label class="text-base-content/70 text-sm font-medium" for="{idPrefix}-notes">Notes</label>
			<textarea
				id="{idPrefix}-notes"
				class={['textarea textarea-bordered w-full resize-none', notesClass]}
				rows={notesRows}
				placeholder={notesPlaceholder}
				bind:value={notes}></textarea>
		</div>

		{@render children?.()}

		<button class="btn btn-primary w-full" onclick={save}>Save</button>
	</div>
</BottomSheet>
