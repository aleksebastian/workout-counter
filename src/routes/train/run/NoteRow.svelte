<script lang="ts">
	import { restTimer } from '$lib/logic/restTimer.svelte';
	import { HAPTIC } from '$lib/haptic';
	import RestCard from '$lib/components/RestCard.svelte';
	import NotesIcon from '$lib/icons/notes.svg?raw';

	/**
	 * The set's note and what's coming next, sharing one row.
	 *
	 * By default Up next (or the rest countdown) has the row, with the note as
	 * a round button beside it. Opening the note trades their widths: the circle
	 * stretches into a field and Up next shrinks to a pill that still shows the
	 * countdown while resting. The pill, Done, or tapping elsewhere trades back.
	 *
	 * Each shape keeps its contents at full size and clips them, so mid-swap
	 * the shapes move but the text never squashes or re-wraps.
	 */

	interface Props {
		notes: string;
		open: boolean;
		/** The set the note will be saved with; `null` hides the note (no set to log). */
		setNumber: number | null;
		/** `null` on the last exercise. */
		next: { name: string; detail: string } | null;
	}

	let { notes = $bindable(''), open = $bindable(false), setNumber, next }: Props = $props();

	let field = $state<HTMLInputElement>();
	let hasDraft = $derived(notes.trim() !== '');
	let canNote = $derived(setNumber !== null);
	let expanded = $derived(open && canNote);

	function openNote() {
		HAPTIC.tap();
		open = true;
		// In the same tap, while the field is still transparent: iOS only raises
		// the keyboard for a focus that happens inside the user's gesture.
		field?.focus();
	}

	// Idempotent rather than a toggle: tapping the pill blurs the field first,
	// which has already closed it.
	function close() {
		open = false;
		field?.blur();
	}
</script>

{#snippet checkIcon()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-5 w-5"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2.5"
		aria-hidden="true"
	>
		<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
	</svg>
{/snippet}

<div class="note-row relative h-11" style="container-type: inline-size">
	{#if canNote}
		<!-- The note: a circle that stretches into a field. -->
		<div
			class="shape bg-base-200 absolute inset-y-0 left-0 overflow-hidden rounded-full"
			style:width={expanded ? 'calc(100% - 4.5rem - 0.5rem)' : '2.75rem'}
		>
			<button
				type="button"
				class="absolute inset-y-0 left-0 flex w-11 items-center justify-center"
				class:text-primary={hasDraft}
				class:text-base-content={!hasDraft}
				aria-label={hasDraft ? `Edit note for set ${setNumber}` : `Add a note to set ${setNumber}`}
				aria-expanded={expanded}
				aria-controls="set-note"
				onclick={openNote}
			>
				<span class="[&>svg]:h-5 [&>svg]:w-5">{@html NotesIcon}</span>
				<span
					class="layer bg-primary absolute top-2 right-2 h-2 w-2 rounded-full"
					class:shown={hasDraft && !expanded}
					aria-hidden="true"
				></span>
			</button>
			<input
				bind:this={field}
				bind:value={notes}
				id="set-note"
				type="text"
				enterkeyhint="done"
				autocomplete="off"
				class="layer absolute inset-y-0 right-4 left-11 min-w-0 bg-transparent text-sm outline-none"
				class:shown={expanded}
				tabindex={expanded ? 0 : -1}
				aria-hidden={!expanded}
				placeholder="Note for set {setNumber}"
				onblur={() => (open = false)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === 'Escape') field?.blur();
				}}
			/>
		</div>
	{/if}

	<!-- What's next: Up next or the rest countdown, shrinking to a pill. -->
	<div
		class="shape bg-base-200 absolute inset-y-0 right-0 overflow-hidden rounded-full"
		style:width={expanded ? '4.5rem' : canNote ? 'calc(100% - 2.75rem - 0.5rem)' : '100%'}
	>
		<!-- Full-width contents, pinned right and clipped as the shape shrinks. -->
		<div
			class="layer absolute inset-y-0 right-0"
			class:shown={!expanded}
			style:width={canNote ? 'calc(100cqw - 3.25rem)' : '100cqw'}
			aria-hidden={expanded}
		>
			{#if restTimer.active}
				<RestCard compact />
			{:else}
				<div class="flex h-11 items-center gap-2.5 px-4 text-sm whitespace-nowrap">
					{#if next}
						<span
							class="text-base-content/50 shrink-0 text-xs font-semibold tracking-widest uppercase"
							>Up next</span
						>
						<span class="min-w-0 truncate">
							<span class="font-bold">{next.name}</span>
							<span class="text-base-content/60">· {next.detail}</span>
						</span>
					{:else}
						<span class="text-base-content/50 text-xs font-semibold tracking-widest uppercase"
							>Last exercise</span
						>
					{/if}
				</div>
			{/if}
		</div>

		<!-- The pill: closes the note, and keeps the countdown in view. -->
		<button
			type="button"
			class="layer absolute inset-y-0 right-0 flex w-18 items-center justify-center text-sm font-semibold"
			class:shown={expanded}
			tabindex={expanded ? 0 : -1}
			aria-hidden={!expanded}
			aria-label={restTimer.active
				? `Rest ${restTimer.display}. Close note`
				: next
					? 'Close note and show up next'
					: 'Close note'}
			onclick={close}
		>
			{#if restTimer.active}
				<span class="text-primary font-black tabular-nums">{restTimer.display}</span>
				<span class="bg-base-content/10 absolute inset-x-3 bottom-1.5 h-0.5 rounded-full">
					<span
						class="bg-primary block h-full rounded-full transition-[width] duration-1000 ease-linear"
						style="width: {restTimer.progress}%"
					></span>
				</span>
			{:else if next}
				Next
			{:else}
				{@render checkIcon()}
			{/if}
		</button>
	</div>
</div>

<style>
	.shape {
		transition: width 320ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	/* Outgoing contents fade fast; incoming ones wait for the shapes to make
	   room, so nothing is seen squeezing through a gap. */
	.layer {
		opacity: 0;
		pointer-events: none;
		transition: opacity 120ms ease-out;
	}

	.layer.shown {
		opacity: 1;
		pointer-events: auto;
		transition: opacity 150ms ease-out 80ms;
	}

	@media (prefers-reduced-motion) {
		.shape,
		.layer,
		.layer.shown {
			transition: none;
		}
	}
</style>
