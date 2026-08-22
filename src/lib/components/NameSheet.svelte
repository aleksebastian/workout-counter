<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';

	interface Props {
		open?: boolean;
		title: string;
		placeholder?: string;
		hint?: string;
		submitLabel?: string;
		/** Pre-fills the field — for renaming rather than creating. */
		initialValue?: string;
		/** Returns an error message, or undefined when the name is acceptable. */
		validate?: (name: string) => string | undefined;
		onSave: (name: string) => void;
	}

	let {
		open = $bindable(false),
		title,
		placeholder = '',
		hint,
		submitLabel = 'Create',
		initialValue = '',
		validate,
		onSave
	}: Props = $props();

	let name = $state('');
	let error = $state<string | undefined>(undefined);
	let input = $state<HTMLInputElement>();

	// Reseed on open so reopening never shows the last attempt's text or error.
	$effect(() => {
		if (open) {
			name = initialValue;
		}
		error = undefined;
	});

	$effect(() => {
		if (open && input) setTimeout(() => input?.focus(), 100);
	});

	function save() {
		error = validate?.(name);
		if (error) return;
		onSave(name.trim());
		open = false;
	}
</script>

<BottomSheet bind:open size="small" {title}>
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-2">
			<input
				bind:this={input}
				aria-label={title}
				type="text"
				autocomplete="off"
				{placeholder}
				class="input input-bordered w-full"
				class:input-error={!!error}
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
				<p class="text-error text-sm">{error}</p>
			{:else if hint}
				<p class="text-base-content/40 text-xs">{hint}</p>
			{/if}
		</div>

		<div class="flex gap-2">
			<button class="btn btn-ghost flex-1" onclick={() => (open = false)}>Cancel</button>
			<button class="btn btn-primary flex-1" onclick={save}>{submitLabel}</button>
		</div>
	</div>
</BottomSheet>
