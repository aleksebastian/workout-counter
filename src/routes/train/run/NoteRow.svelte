<script lang="ts">
	import { cubicIn, cubicOut } from 'svelte/easing';
	import type { TransitionConfig } from 'svelte/transition';
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
		/**
		 * The keyboard is up, e.g. typing reps or weight. The note opens too, so
		 * it's one tap (or the keyboard's arrows) away while the set is being
		 * typed in, and closes again with the keyboard.
		 */
		keyboardUp?: boolean;
	}

	let {
		notes = $bindable(''),
		open = $bindable(false),
		setNumber,
		next,
		keyboardUp = false
	}: Props = $props();

	/**
	 * Up next and the rest countdown take turns in the same place, so they
	 * roll like a ticker rather than dissolving: the newcomer rises in from
	 * just below as the other rises out. Both directions read "what's on now
	 * changed". Reduced motion keeps only the crossfade.
	 */
	const SHIFT = 8;
	const reducedMotion = () =>
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	function rollIn(_node: Element): TransitionConfig {
		const shift = reducedMotion() ? 0 : SHIFT;
		return {
			duration: 260,
			delay: 60,
			easing: cubicOut,
			css: (t, u) => `opacity: ${t}; transform: translateY(${u * shift}px)`
		};
	}

	function rollOut(_node: Element): TransitionConfig {
		const shift = reducedMotion() ? 0 : SHIFT;
		return {
			duration: 180,
			easing: cubicIn,
			css: (t, u) => `opacity: ${t}; transform: translateY(${-u * shift}px)`
		};
	}

	/** While resting, what the rest is for: the next set, or the next exercise. */
	let restNext = $derived(
		setNumber !== null
			? `Next: set ${setNumber}`
			: next
				? `Next: ${next.name}`
				: 'Last exercise done'
	);

	let field = $state<HTMLInputElement>();
	let hasDraft = $derived(notes.trim() !== '');
	let canNote = $derived(setNumber !== null);
	let expanded = $derived((open || keyboardUp) && canNote);

	function openNote() {
		HAPTIC.tap();
		open = true;
		// In the same tap, while the field is still transparent: iOS only raises
		// the keyboard for a focus that happens inside the user's gesture.
		field?.focus();
	}

	// Idempotent rather than a toggle: tapping the pill blurs the field first,
	// which has already closed it. Whatever has focus lets go — a reps or
	// weight field too — so the keyboard that's holding the row open goes.
	function close() {
		open = false;
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
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
			style:width={expanded ? 'calc(100% - 5.5rem - 0.5rem)' : '2.75rem'}
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
				placeholder="Notes"
				aria-label="Note for set {setNumber}"
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
		style:width={expanded ? '5.5rem' : canNote ? 'calc(100% - 2.75rem - 0.5rem)' : '100%'}
	>
		<!-- Full-width contents, pinned right and clipped as the shape shrinks. -->
		<div
			class="layer absolute inset-y-0 right-0"
			class:shown={!expanded}
			style:width={canNote ? 'calc(100cqw - 3.25rem)' : '100cqw'}
			aria-hidden={expanded}
		>
			<!-- Stacked, so the outgoing one can roll away while the other rolls in. -->
			{#if restTimer.active}
				<div class="absolute inset-0" in:rollIn out:rollOut>
					<RestCard compact next={restNext} />
				</div>
			{:else}
				<div
					class="absolute inset-0 flex h-11 items-center gap-2.5 px-4 text-sm whitespace-nowrap"
					in:rollIn
					out:rollOut
				>
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
			class="layer absolute inset-y-0 right-0 flex w-22 items-center justify-center text-sm font-semibold whitespace-nowrap"
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
				<span class="absolute inset-0 flex items-center justify-center" in:rollIn out:rollOut>
					<span class="text-primary font-black tabular-nums">{restTimer.display}</span>
					<span class="bg-base-content/10 absolute inset-x-3 bottom-1.5 h-0.5 rounded-full">
						<span
							class="bg-primary block h-full rounded-full transition-[width] duration-1000 ease-linear"
							style="width: {restTimer.progress}%"
						></span>
					</span>
				</span>
			{:else}
				<span class="absolute inset-0 flex items-center justify-center" in:rollIn out:rollOut>
					{#if next}
						Up next
					{:else}
						{@render checkIcon()}
					{/if}
				</span>
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
