<script lang="ts">
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { TransitionConfig } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		size?: 'small' | 'medium' | 'large' | 'full';
		title?: string;
		onClose?: () => void;
		children?: any;
		headerAction?: Snippet;
	}

	let {
		open = $bindable(false),
		size = 'medium',
		title,
		onClose,
		children,
		headerAction
	}: Props = $props();

	// Custom slide transition that uses element's actual height to prevent overshoot
	function slideUp(
		node: HTMLElement,
		{ duration = 350 }: { duration?: number } = {}
	): TransitionConfig {
		const height = node.offsetHeight;
		return {
			duration,
			easing: cubicOut,
			css: (t) => `transform: translateY(${(1 - t) * height}px);`
		};
	}

	let sheetElement = $state<HTMLElement>();
	let startY = 0;
	let currentY = 0;
	let isDragging = false;
	let keyboardOffset = $state(0);

	const sizeClasses = {
		small: 'max-h-[40svh]',
		medium: 'max-h-[60svh]',
		large: 'max-h-[85svh]',
		full: 'max-h-[95svh]'
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
			// Disable transition while dragging so the sheet tracks the finger directly
			sheetElement.style.transition = 'none';
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

		// Restore transition for snap-back, then clear transform
		if (sheetElement) {
			sheetElement.style.transition = '';
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

	// Focus trap and iOS keyboard handling
	$effect(() => {
		if (!open || !sheetElement) return;

		// Delay focus until after the slide-up animation completes (350ms).
		// Without this, iOS opens the keyboard before the sheet is in position,
		// causing the keyboard to render on top of the bottom sheet.
		const focusTimer = setTimeout(() => {
			if (!sheetElement) return;
			const focusableElements = sheetElement.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			const firstElement = focusableElements[0] as HTMLElement;
			firstElement?.focus();
		}, 350);

		// iOS keyboard handling: scroll input into view when focused
		const inputs = sheetElement.querySelectorAll('input, textarea');
		const handleFocus = (e: Event) => {
			const target = e.target as HTMLElement;
			setTimeout(() => {
				target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			}, 300); // delay for keyboard animation
		};

		inputs.forEach((input) => {
			input.addEventListener('focus', handleFocus);
		});

		return () => {
			clearTimeout(focusTimer);
			inputs.forEach((input) => {
				input.removeEventListener('focus', handleFocus);
			});
		};
	});

	// Visual viewport tracking: lift sheet above the software keyboard
	$effect(() => {
		if (!open || typeof window === 'undefined' || !window.visualViewport) return;

		const vv = window.visualViewport;

		function updateOffset() {
			keyboardOffset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
		}

		vv.addEventListener('resize', updateOffset);
		vv.addEventListener('scroll', updateOffset);
		updateOffset();

		return () => {
			vv.removeEventListener('resize', updateOffset);
			vv.removeEventListener('scroll', updateOffset);
			keyboardOffset = 0;
		};
	});

	// iOS-safe scroll lock: position:fixed prevents touch-scroll on background
	let savedScrollY = 0;
	let didLock = false;

	$effect(() => {
		if (open) {
			savedScrollY = window.scrollY;
			didLock = true;
			document.body.style.position = 'fixed';
			document.body.style.top = `-${savedScrollY}px`;
			document.body.style.left = '0';
			document.body.style.right = '0';
			document.body.style.overflow = 'hidden';
		} else if (didLock) {
			// Only unlock a lock we actually took. This effect also runs on mount
			// with `open` false, and unconditionally restoring would clear styles
			// we never set and scroll the page to 0 — visible on any page that
			// mounts a closed sheet, and the Library mounts three.
			didLock = false;
			document.body.style.position = '';
			document.body.style.top = '';
			document.body.style.left = '';
			document.body.style.right = '';
			document.body.style.overflow = '';
			window.scrollTo(0, savedScrollY);
		}
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-1000 flex items-end"
		style="overflow-y: auto; -webkit-overflow-scrolling: touch; padding-bottom: {keyboardOffset}px;"
		in:fade={{ duration: 200 }}
		out:fade={{ duration: 250 }}
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
			class="bg-base-100 relative flex w-full flex-col rounded-t-3xl shadow-2xl {sizeClasses[size]}"
			style="padding-bottom: env(safe-area-inset-bottom, 0px); touch-action: pan-y;"
			in:slideUp={{ duration: 350 }}
			out:slideUp={{ duration: 300 }}
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? 'sheet-title' : undefined}
			tabindex="-1"
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
			ontouchend={handleTouchEnd}
		>
			<!-- Drag Handle -->
			<div class="flex shrink-0 justify-center pt-3 pb-2">
				<div class="bg-base-content/20 h-1 w-10 rounded-full"></div>
			</div>

			<!-- Header -->
			{#if title}
				<div class="border-base-300 shrink-0 border-b px-6 pt-2 pb-4">
					<div class="flex items-center gap-4">
						<h2 id="sheet-title" class="min-w-0 flex-1 truncate text-lg font-bold">{title}</h2>
						{#if headerAction}<div class="shrink-0">{@render headerAction()}</div>{/if}
					</div>
				</div>
			{/if}
			<!-- Content -->
			<div class="flex-1 overflow-y-auto px-6 py-4" style="min-height: 0">
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Snap-back transition applied via inline style in handleTouchEnd */
	.relative {
		transition: transform 0.2s ease-out;
	}
</style>
