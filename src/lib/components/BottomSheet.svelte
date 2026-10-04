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
		/** Pinned under the header, outside the scrolling content (e.g. a search field). */
		toolbar?: Snippet;
		/** Pinned at the bottom, outside the scrolling content (e.g. a confirm button). */
		footer?: Snippet;
		/**
		 * Focus the first focusable control on open. Turn off for sheets whose first
		 * control is an input that shouldn't summon the keyboard by itself; the
		 * sheet itself takes focus instead.
		 */
		autofocus?: boolean;
		/**
		 * Hold the sheet at its full size instead of sizing to the content, for
		 * pickers whose list filters as you type — otherwise the sheet jumps with
		 * every keystroke. Shrinks by the keyboard so the content stays visible.
		 */
		fill?: boolean;
	}

	let {
		open = $bindable(false),
		size = 'medium',
		title,
		onClose,
		children,
		headerAction,
		toolbar,
		footer,
		autofocus = true,
		fill = false
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
	let contentElement = $state<HTMLElement>();
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
	const fillHeights = { small: '40svh', medium: '60svh', large: '85svh', full: '95svh' };

	function close() {
		open = false;
		onClose?.();
	}

	// Pulling down closes the sheet only when its content is already scrolled to
	// the top, or the touch starts outside the scrolling area (handle, title).
	// Otherwise the same gesture is the user scrolling the list back up — treating
	// it as a dismiss dragged the whole sheet down mid-scroll.
	function handleTouchStart(e: TouchEvent) {
		const inContent = contentElement?.contains(e.target as Node) ?? false;
		if (inContent && (contentElement?.scrollTop ?? 0) > 0) return;
		startY = e.touches[0].clientY;
		currentY = startY;
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

	// Focus only once the slide-up has actually finished. iOS places the caret
	// (and its tap targets) wherever the input is at the moment of focus, so
	// focusing mid-animation strands the caret away from the field.
	function focusFirst() {
		if (!sheetElement || sheetElement.contains(document.activeElement)) return;
		if (!autofocus) {
			sheetElement.focus();
			return;
		}
		sheetElement
			.querySelector<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			)
			?.focus();
	}

	$effect(() => {
		if (!open || !sheetElement) return;

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
			inputs.forEach((input) => {
				input.removeEventListener('focus', handleFocus);
			});
		};
	});

	// Visual viewport tracking: lift sheet above the software keyboard. While it's
	// up the keyboard covers the home indicator, so the sheet drops its own
	// safe-area padding — keeping it left a blank band above the keyboard.
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
			style="padding-bottom: {keyboardOffset > 0
				? '0px'
				: 'env(safe-area-inset-bottom, 0px)'}; touch-action: pan-y;{fill
				? ` height: calc(${fillHeights[size]} - ${keyboardOffset}px);`
				: ''}"
			in:slideUp={{ duration: 350 }}
			onintroend={focusFirst}
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
			{#if toolbar}
				<div class="shrink-0 px-6 pt-4">{@render toolbar()}</div>
			{/if}
			<!-- Content -->
			<div
				bind:this={contentElement}
				class="flex-1 overflow-y-auto overscroll-contain px-6 py-4"
				style="min-height: 0"
			>
				{@render children?.()}
			</div>
			{#if footer}
				<div class="border-base-300 shrink-0 border-t px-6 py-3">{@render footer()}</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Snap-back transition applied via inline style in handleTouchEnd */
	.relative {
		transition: transform 0.2s ease-out;
	}
</style>
