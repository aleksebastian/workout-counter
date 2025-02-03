<script lang="ts">
	import { toaster } from '$lib/state.svelte';
	import Toast from './Toast_v2.svelte';
</script>

<div class="toast">
	{#each toaster.getToasts() as toast (toast.id)}
		<Toast
			type={toast.type}
			dismissible={toast.dismissible}
			message={toast.message}
			dismiss={() => toaster.dismissToast(toast.id)}
		/>
	{/each}
</div>
