<script lang="ts">
	import { toaster } from '$lib/toast.svelte';
	import Toast from './Toast_v2.svelte';
</script>

<div class="toast">
	{#each toaster.items as toast (toast.id)}
		<Toast
			type={toast.type}
			dismissible={toast.dismissible}
			message={toast.message}
			dismiss={() => toaster.dismiss(toast.id)}
		/>
	{/each}
</div>
