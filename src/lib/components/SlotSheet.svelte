<script lang="ts" module>
	import MorningIcon from '$lib/icons/slot-morning.svg?raw';
	import MiddayIcon from '$lib/icons/slot-midday.svg?raw';
	import AfternoonIcon from '$lib/icons/slot-afternoon.svg?raw';
	import EveningIcon from '$lib/icons/slot-evening.svg?raw';
	import NightIcon from '$lib/icons/slot-night.svg?raw';
	import ClockIcon from '$lib/icons/clock.svg?raw';
	import type { Slot } from '$lib/types';

	/** The icon for a slot; a session without one gets a plain clock. */
	export function slotIcon(slot: Slot | undefined): string {
		switch (slot) {
			case 'morning':
				return MorningIcon;
			case 'midday':
				return MiddayIcon;
			case 'afternoon':
				return AfternoonIcon;
			case 'evening':
				return EveningIcon;
			case 'night':
				return NightIcon;
			default:
				return ClockIcon;
		}
	}
</script>

<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { HAPTIC } from '$lib/haptic';
	import { ANYTIME, SLOT_LABEL, SLOTS } from '$lib/types';

	interface Props {
		open?: boolean;
		title: string;
		subtitle?: string;
		/** What each slot already holds this day, e.g. "Has Mobility". */
		taken?: Partial<Record<Slot | 'anytime', string>>;
		/** Where the session being changed sits now, marked as current. */
		current?: Slot | 'anytime' | null;
		/** `undefined` picks Anytime. */
		onPick: (slot: Slot | undefined) => void;
	}

	let { open = $bindable(false), title, subtitle, taken = {}, current, onPick }: Props = $props();

	const rows: { slot: Slot | undefined; label: string; hint?: string }[] = [
		...SLOTS.map((slot) => ({ slot, label: SLOT_LABEL[slot] })),
		{ slot: undefined, label: ANYTIME, hint: 'No set time · listed last' }
	];

	function pick(slot: Slot | undefined) {
		HAPTIC.tap();
		open = false;
		onPick(slot);
	}
</script>

<BottomSheet bind:open size="large" {title}>
	<div class="flex flex-col gap-1">
		{#if subtitle}
			<p class="text-base-content/50 mb-2 text-sm">{subtitle}</p>
		{/if}
		{#each rows as row (row.label)}
			{@const note = taken[row.slot ?? 'anytime']}
			{@const isCurrent = !!current && current === (row.slot ?? 'anytime')}
			{#if !row.slot}
				<hr class="border-base-300 mx-3 my-1" />
			{/if}
			<button
				class="hover:bg-base-200 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors"
				class:bg-base-200={isCurrent}
				aria-current={isCurrent ? 'true' : undefined}
				onclick={() => pick(row.slot)}
			>
				<span class="text-base-content/60 shrink-0 [&>svg]:h-5 [&>svg]:w-5">
					{@html slotIcon(row.slot)}
				</span>
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="font-medium">{row.label}</span>
					{#if note || row.hint}
						<span class="text-base-content/50 truncate text-xs">{note ?? row.hint}</span>
					{/if}
				</span>
			</button>
		{/each}
	</div>
</BottomSheet>
