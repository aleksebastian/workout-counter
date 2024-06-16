<script lang="ts">
	export let noTopMargin = false;
</script>

<div class="modal-action gap-4" class:mt-0={noTopMargin}>
	<slot />
</div>
