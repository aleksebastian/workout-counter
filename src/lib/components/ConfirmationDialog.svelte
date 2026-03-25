<script lang="ts">
	import DeleteIcon from '$lib/icons/delete.svg?raw';

	interface Props {
		header?: string;
		actionLabel?: string;
		cancelLabel?: string;
		content?: string | undefined;
		destructive?: boolean;
		dialog: HTMLDialogElement;
		onclose: (event: Event) => void;
		children?: import('svelte').Snippet;
	}

	let {
		header = 'Are you sure?',
		actionLabel = 'Ok',
		cancelLabel = 'Cancel',
		content = undefined,
		destructive = false,
		dialog = $bindable(),
		onclose,
		children
	}: Props = $props();
</script>

<dialog bind:this={dialog} {onclose} class="modal">
	<!-- Backdrop close -->
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
	<form method="dialog" class="modal-box flex w-80 flex-col items-center gap-3 px-6 py-6">
		<!-- Icon -->
		{#if destructive}
			<div
				class="bg-error/15 text-error flex h-12 w-12 flex-none items-center justify-center rounded-full [&_svg]:h-6 [&_svg]:w-6 [&_svg]:fill-current"
			>
				{@html DeleteIcon}
			</div>
		{/if}

		<!-- Header + body -->
		<div class="text-center">
			<h3 class="text-base font-bold">{header}</h3>
			{#if children}
				{@render children()}
			{:else if content}
				<p class="text-base-content/55 mt-1 text-sm">{content}</p>
			{/if}
		</div>

		<!-- Actions — stacked, full width -->
		<div class="mt-1 flex w-full flex-col gap-2">
			<button
				class={destructive ? 'btn btn-error w-full' : 'btn btn-primary w-full'}
				value="default"
			>
				{actionLabel}
			</button>
			<button class="btn btn-ghost w-full" value="cancel">{cancelLabel}</button>
		</div>
	</form>
</dialog>
