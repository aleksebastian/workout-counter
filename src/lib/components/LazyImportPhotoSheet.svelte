<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type ImportPhotoSheet from './ImportPhotoSheet.svelte';
	import { toaster } from '$lib/toast.svelte';

	/**
	 * ImportPhotoSheet, kept out of the page's first load: it's one of the
	 * larger pieces of the app and most visits to Discover or the Library
	 * never open it. It's fetched shortly after the page settles, so the first
	 * tap is still instant, or on that tap if it comes sooner.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	/** After the page has had its first paint and data to itself. */
	const PREFETCH_AFTER_MS = 1500;

	let Sheet = $state.raw<typeof ImportPhotoSheet | null>(null);
	/**
	 * False for the sheet's first render: mounted already open, it would skip
	 * its slide-in, so it mounts closed and opens a tick later.
	 */
	let mounted = $state(false);
	let request: Promise<void> | null = null;

	function load() {
		request ??= import('./ImportPhotoSheet.svelte')
			.then(async (module) => {
				Sheet = module.default;
				await tick();
				mounted = true;
			})
			.catch((err) => {
				request = null; // so the next open tries again
				throw err;
			});
		return request;
	}

	onMount(() => {
		const prefetch = setTimeout(() => load().catch(() => {}), PREFETCH_AFTER_MS);
		return () => clearTimeout(prefetch);
	});

	$effect(() => {
		if (!open || mounted) return;
		load().catch((err) => {
			console.error('[import] loading the photo sheet failed:', err);
			open = false;
			toaster.error("Couldn't open photo import — try again", 'import-sheet-load');
		});
	});
</script>

{#if Sheet}
	<Sheet bind:open={() => open && mounted, (value) => (open = value)} />
{/if}
