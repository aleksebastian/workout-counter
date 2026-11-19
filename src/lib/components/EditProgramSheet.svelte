<script lang="ts">
	import NameNotesSheet from '$lib/components/NameNotesSheet.svelte';
	import { session } from '$lib/session.svelte';
	import type { Program } from '$lib/types';

	interface Props {
		open?: boolean;
		program: Program | null | undefined;
		onSave: (name: string, notes: string) => void;
	}

	let { open = $bindable(false), program, onSave }: Props = $props();
</script>

<NameNotesSheet
	bind:open
	title="Edit program"
	size="medium"
	kind="Program"
	idPrefix="edit-program"
	item={program}
	existing={session.programs}
	notesPlaceholder="Optional notes about this program…"
	inputClass="text-base"
	notesClass="text-base"
	{onSave}
/>
