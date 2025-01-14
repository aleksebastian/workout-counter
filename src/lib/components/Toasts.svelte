<script lang="ts">
	import { dismissToast, toasts$ } from '$lib/store';
	import Toast from './Toast_v2.svelte';
</script>

<div class="toast">
	{#each $toasts$ as toast (toast.id)}
		<Toast
			type={toast.type}
			dismissible={toast.dismissible}
			message={toast.message}
			dismiss={() => dismissToast(toast.id)}
		/>
	{/each}
</div>
