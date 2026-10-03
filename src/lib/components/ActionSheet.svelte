<script lang="ts" module>
	export type SheetAction = {
		label: string;
		/** Inline SVG markup, e.g. an imported `?raw` icon. */
		icon?: string;
		destructive?: boolean;
		onSelect: () => void;
	};
</script>

<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { HAPTIC } from '$lib/haptic';

	interface Props {
		open?: boolean;
		title?: string;
		subtitle?: string;
		actions: SheetAction[];
	}

	let { open = $bindable(false), title, subtitle, actions }: Props = $props();

	function select(action: SheetAction) {
		HAPTIC.tap();
		open = false;
		action.onSelect();
	}
</script>

<BottomSheet bind:open size="small" {title}>
	<div class="flex flex-col gap-1">
		{#if subtitle}
			<p class="text-base-content/50 mb-2 text-sm">{subtitle}</p>
		{/if}
		{#each actions as action}
			<button
				class="hover:bg-base-200 flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition-colors"
				class:text-error={action.destructive}
				onclick={() => select(action)}
			>
				{#if action.icon}
					<span
						class={[
							'shrink-0 [&>svg]:h-5 [&>svg]:w-5',
							action.destructive ? 'text-error' : 'text-base-content/60'
						].join(' ')}
					>
						{@html action.icon}
					</span>
				{/if}
				<span class="font-medium">{action.label}</span>
			</button>
		{/each}
	</div>
</BottomSheet>
