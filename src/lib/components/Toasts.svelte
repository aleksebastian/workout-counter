<script lang="ts">
	import { toaster } from '$lib/toast.svelte';
	import Toast from './Toast_v2.svelte';
</script>

<!-- Above the account screen and sheets (z-1000), which can stay open while a toast shows. -->
<div class="toast z-1100">
	{#each toaster.items as toast (toast.id)}
		<Toast
			type={toast.type}
			dismissible={toast.dismissible}
			message={toast.message}
			dismiss={() => toaster.dismiss(toast.id)}
		/>
	{/each}
</div>
