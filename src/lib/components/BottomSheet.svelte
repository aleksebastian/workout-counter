<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	interface Props {
		open?: boolean;
		size?: 'small' | 'medium' | 'large' | 'full';
		title?: string;
		onClose?: () => void;
		children?: any;
	}

	let { open = $bindable(false), size = 'medium', title, onClose, children }: Props = $props();

	let sheetElement = $state<HTMLElement>();
	let startY = 0;
	let currentY = 0;
	let isDragging = false;

	const sizeClasses = {
		small: 'max-h-[40vh]',
		medium: 'max-h-[60vh]',
		large: 'max-h-[85vh]',
		full: 'max-h-[95vh]'
	};

	function close() {
		open = false;
		onClose?.();
	}

	function handleTouchStart(e: TouchEvent) {
		startY = e.touches[0].clientY;
		isDragging = true;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging) return;
		currentY = e.touches[0].clientY;
		const diff = currentY - startY;

		// Only allow downward drag
		if (diff > 0 && sheetElement) {
			sheetElement.style.transform = `translateY(${diff}px)`;
		}
	}

	function handleTouchEnd() {
		if (!isDragging) return;
		isDragging = false;

		const diff = currentY - startY;

		// If dragged down more than 100px, close
		if (diff > 100) {
			close();
		}

		// Reset transform
		if (sheetElement) {
			sheetElement.style.transform = '';
		}

		startY = 0;
		currentY = 0;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			close();
		}
	}

	// Focus trap
	onMount(() => {
		if (open && sheetElement) {
			const focusableElements = sheetElement.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			const firstElement = focusableElements[0] as HTMLElement;
			firstElement?.focus();
		}
	});

	$effect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-1000 flex items-end"
		transition:fade={{ duration: 200 }}
		onkeydown={handleKeydown}
		role="presentation"
	>
		<!-- Backdrop -->
		<div
			class="absolute inset-0 bg-black/40 backdrop-blur-sm"
			onclick={close}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && close()}
			role="button"
			tabindex="-1"
			aria-label="Close sheet"
		></div>

		<!-- Bottom Sheet -->
		<div
			bind:this={sheetElement}
			class="bg-base-100 relative w-full rounded-t-3xl shadow-2xl {sizeClasses[size]}"
			style="padding-bottom: env(safe-area-inset-bottom, 0px)"
			transition:fly={{ y: 500, duration: 350, easing: cubicOut }}
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? 'sheet-title' : undefined}
			tabindex="-1"
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
			ontouchend={handleTouchEnd}
		>
			<!-- Drag Handle -->
			<div class="flex justify-center pt-3 pb-2">
				<div class="bg-base-content/20 h-1 w-10 rounded-full"></div>
			</div>

			<!-- Header -->
			{#if title}
				<div class="border-base-300 border-b px-6 pt-2 pb-4">
					<h2 id="sheet-title" class="text-lg font-bold">{title}</h2>
				</div>
			{/if}
			<!-- Content -->
			<div class="overflow-y-auto px-6 py-4" style="max-height: calc(90vh - 120px)">
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Smooth transition for touch drag */
	.relative {
		transition: transform 0.2s ease-out;
	}
</style>
