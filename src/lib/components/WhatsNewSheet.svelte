<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { CHANGELOG, type ChangelogEntry } from '$lib/changelog';
	import { pwa } from '$lib/logic/pwa.svelte';

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	const SECTIONS: { key: 'new' | 'improved' | 'fixed'; label: string; dot: string }[] = [
		{ key: 'new', label: 'New', dot: 'bg-primary' },
		{ key: 'improved', label: 'Improved', dot: 'bg-info' },
		{ key: 'fixed', label: 'Fixed', dot: 'bg-base-content/30' }
	];

	const dateFormat = new Intl.DateTimeFormat(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	function formatDate(entry: ChangelogEntry) {
		// Noon, so no timezone shifts the day.
		return dateFormat.format(new Date(`${entry.date}T12:00:00`));
	}

	// Reading the notes, from here or the post-update banner, counts as seeing them.
	$effect(() => {
		if (open) pwa.markWhatsNewSeen();
	});
</script>

<BottomSheet bind:open size="large" title="What's new" autofocus={false}>
	<div class="flex flex-col gap-6 pb-2">
		{#each CHANGELOG as entry, i (entry.version)}
			<section class="flex flex-col gap-3">
				<div class="flex items-baseline justify-between gap-3">
					<h3 class="font-semibold">
						Version {entry.version}
						{#if i === 0}<span class="badge badge-primary badge-sm ml-1 align-middle">Latest</span
							>{/if}
					</h3>
					<p class="text-base-content/40 text-xs">{formatDate(entry)}</p>
				</div>
				<div class="bg-base-200 flex flex-col gap-4 rounded-2xl px-4 py-4">
					{#each SECTIONS as section (section.key)}
						{@const items = entry[section.key]}
						{#if items?.length}
							<div class="flex flex-col gap-2">
								<p class="text-base-content/40 text-xs font-semibold tracking-widest uppercase">
									{section.label}
								</p>
								<ul class="flex flex-col gap-1.5">
									{#each items as item (item)}
										<li class="flex gap-2.5 text-sm">
											<span class="{section.dot} mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"></span>
											<span>{item}</span>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					{/each}
				</div>
			</section>
		{/each}
	</div>
</BottomSheet>
