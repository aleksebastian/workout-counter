<script lang="ts" generics="T">
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import type { Snippet } from 'svelte';
	import { HAPTIC } from '$lib/haptic';
	import DragIndicatorIcon from '$lib/icons/drag_indicator.svg?raw';

	interface Props {
		items: T[];
		key: (item: T) => string;
		/** Called once on drop, with the settled order. */
		onReorder: (items: T[]) => void;
		/** Hides the handles and disables dragging. */
		disabled?: boolean;
		children: Snippet<[T, number]>;
	}

	let { items, key, onReorder, disabled = false, children }: Props = $props();

	// Local mirror so rows animate as the finger moves; the parent is only told
	// about the new order on drop.
	let order = $state<T[]>([]);
	let dragIndex = $state<number | null>(null);
	let container = $state<HTMLElement>();

	$effect(() => {
		// Resync when the source list changes underneath us (another device, or
		// our own write landing) — but never mid-drag, which would fight the user.
		if (dragIndex === null) order = [...items];
	});

	function move(from: number, to: number) {
		if (to < 0 || to >= order.length || from === to) return;
		const next = [...order];
		const [item] = next.splice(from, 1);
		next.splice(to, 0, item);
		order = next;
		HAPTIC.tap();
	}

	function rowIndexAt(clientY: number): number {
		const rows = container?.querySelectorAll('[data-sortable-row]');
		if (!rows) return -1;
		for (let i = 0; i < rows.length; i++) {
			const rect = rows[i].getBoundingClientRect();
			if (clientY >= rect.top && clientY <= rect.bottom) return i;
		}
		return -1;
	}

	function onPointerDown(e: PointerEvent, index: number) {
		if (disabled) return;
		e.preventDefault();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		dragIndex = index;
		HAPTIC.tap();
	}

	function onPointerMove(e: PointerEvent) {
		if (dragIndex === null) return;
		const over = rowIndexAt(e.clientY);
		if (over !== -1 && over !== dragIndex) {
			move(dragIndex, over);
			dragIndex = over;
		}
	}

	function onPointerUp() {
		if (dragIndex === null) return;
		dragIndex = null;
		const changed = order.some((item, i) => key(item) !== key(items[i] ?? item));
		if (changed) onReorder([...order]);
	}

	function onKeyDown(e: KeyboardEvent, index: number) {
		if (disabled) return;
		const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
		if (!delta) return;
		e.preventDefault();
		move(index, index + delta);
		onReorder([...order]);
		// Keep focus on the handle that moved so repeated presses keep working.
		queueMicrotask(() => {
			const handles = container?.querySelectorAll<HTMLElement>('[data-sortable-handle]');
			handles?.[index + delta]?.focus();
		});
	}
</script>

<div bind:this={container} class="flex flex-col gap-2">
	{#each order as item, i (key(item))}
		<div
			data-sortable-row
			animate:flip={{ duration: 250, easing: cubicOut }}
			class="sortable-row flex items-center gap-2 transition-opacity"
			class:is-dragging={dragIndex === i}
		>
			<div class="min-w-0 flex-1">
				{@render children(item, i)}
			</div>
			{#if !disabled}
				<button
					data-sortable-handle
					type="button"
					class="drag-handle text-base-content/40 hover:text-base-content/70 shrink-0 cursor-grab rounded-lg p-2 transition-colors active:cursor-grabbing"
					aria-label="Reorder item {i + 1} of {order.length}. Use arrow keys to move."
					onpointerdown={(e) => onPointerDown(e, i)}
					onpointermove={onPointerMove}
					onpointerup={onPointerUp}
					onpointercancel={onPointerUp}
					onkeydown={(e) => onKeyDown(e, i)}
				>
					{@html DragIndicatorIcon}
				</button>
			{/if}
		</div>
	{/each}
</div>

<style>
	.sortable-row.is-dragging {
		opacity: 0.55;
	}

	.drag-handle {
		touch-action: none;
	}
</style>
