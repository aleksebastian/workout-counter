<script lang="ts">
	import { fade } from 'svelte/transition';

	export let styles: string;
</script>

<div class="toast toast-end" transition:fade={{ duration: 250 }}>
	<div class="alert alert-info flex gap-2 bg-neutral text-neutral-content {styles}">
		<slot />
	</div>
</div>
