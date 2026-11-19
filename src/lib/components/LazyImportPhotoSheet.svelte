<script lang="ts">
	import { tick } from 'svelte';
	import type ImportPhotoSheet from './ImportPhotoSheet.svelte';
	import { toaster } from '$lib/toast.svelte';

	/**
	 * ImportPhotoSheet, loaded the first time it opens. It's one of the larger
	 * pieces of the app and most visits to Discover or the Library never open
	 * it. The installed app has it cached with the rest of the build, so the
	 * first open is still immediate offline.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	let Sheet = $state.raw<typeof ImportPhotoSheet | null>(null);
	/**
	 * False for the sheet's first render: mounted already open, it would skip
	 * its slide-in, so it mounts closed and opens a tick later.
	 */
	let mounted = $state(false);
	let loading = false;

	$effect(() => {
		if (!open || Sheet || loading) return;
		loading = true;
		import('./ImportPhotoSheet.svelte')
			.then(async (module) => {
				Sheet = module.default;
				await tick();
				mounted = true;
			})
			.catch((err) => {
				console.error('[import] loading the photo sheet failed:', err);
				open = false;
				toaster.error("Couldn't open photo import — try again", 'import-sheet-load');
			})
			.finally(() => (loading = false));
	});
</script>

{#if Sheet}
	<Sheet bind:open={() => open && mounted, (value) => (open = value)} />
{/if}
