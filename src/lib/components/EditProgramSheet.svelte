<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { session } from '$lib/session.svelte';
	import { getProgramNameValidationMsg } from '$lib/utils';
	import type { Program } from '$lib/types';

	interface Props {
		open?: boolean;
		program: Program | null | undefined;
		onSave: (name: string, notes: string) => void;
	}

	let { open = $bindable(false), program, onSave }: Props = $props();

	let name = $state('');
	let notes = $state('');
	let error = $state<string | undefined>(undefined);
	let input = $state<HTMLInputElement>();

	$effect(() => {
		if (open && program) {
			name = program.name;
			notes = program.notes ?? '';
			error = undefined;
		}
	});

	$effect(() => {
		if (open && input) setTimeout(() => input?.focus(), 100);
	});

	function save() {
		error = getProgramNameValidationMsg(
			name,
			(session.programs ?? []).filter((p) => p.id !== program?.id)
		);
		if (error) return;
		onSave(name, notes);
		open = false;
	}
</script>

<BottomSheet bind:open size="medium" title="Edit Program">
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label class="text-base-content/60 text-sm font-medium" for="edit-program-name">Name</label>
			<input
				id="edit-program-name"
				bind:this={input}
				type="text"
				autocomplete="off"
				class="input input-bordered w-full text-base"
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
				<p class="text-error px-0.5 text-xs">{error}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<label class="text-base-content/60 text-sm font-medium" for="edit-program-notes">Notes</label>
			<textarea
				id="edit-program-notes"
				rows="3"
				class="textarea textarea-bordered w-full resize-none text-base"
				placeholder="Optional notes about this program…"
				bind:value={notes}></textarea>
		</div>

		<button class="btn btn-primary w-full" onclick={save}>Save</button>
	</div>
</BottomSheet>
