<script lang="ts">
	import { toaster } from '$lib/toast.svelte';
	import Toast from './Toast_v2.svelte';

	interface Props {
		/** CSS `bottom`, so toasts can sit above whatever is pinned to the bottom edge. */
		bottom?: string;
	}

	let { bottom }: Props = $props();
</script>

<!-- Above the account screen and sheets (z-1000), which can stay open while a toast shows. -->
<div class="toast z-1100" style:bottom style:transition="bottom 300ms ease-out">
	{#each toaster.items as toast (toast.id)}
		<Toast
			type={toast.type}
			dismissible={toast.dismissible}
			message={toast.message}
			action={toast.action}
			dismiss={() => toaster.dismiss(toast.id)}
		/>
	{/each}
</div>
