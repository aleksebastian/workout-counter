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

	// Capped at 100% of the overlay too, which shrinks to the space above the
	// keyboard while it's open.
	const maxHeights = {
		small: 'min(40svh, 100%)',
		medium: 'min(60svh, 100%)',
		large: 'min(85svh, 100%)',
		full: 'min(95svh, 100%)'
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

	// Focus the sheet's input only once the slide-up has actually finished.
	// iOS places the caret (and its tap targets) wherever the input is at the
	// moment of focus, so focusing mid-animation strands the caret below the
	// field and makes the buttons under it untappable.
	function focusFirst() {
		if (!sheetElement || sheetElement.contains(document.activeElement)) return;
		const target =
			sheetElement.querySelector<HTMLElement>('[autofocus], input, textarea, select') ??
			sheetElement.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
		target?.focus();
	}

	// Pin the overlay to the visual viewport — the area actually visible above
	// the software keyboard — so the sheet always sits right on top of it and
	// iOS never needs to pan the page to reveal the focused input. Tracked even
	// while closed so the outro follows the keyboard as it slides away.
	let viewport = $state<{ top: number; height: number }>();

	$effect(() => {
		if (typeof window === 'undefined' || !window.visualViewport) return;

		const vv = window.visualViewport;
		const update = () => (viewport = { top: vv.offsetTop, height: vv.height });

		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		update();

		return () => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
		};
	});

	// iOS-safe scroll lock: position:fixed prevents touch-scroll on background
	let savedScrollY = 0;
	let didLock = false;
	let cancelPendingUnlock: (() => void) | undefined;

	function lockScroll() {
		savedScrollY = window.scrollY;
		didLock = true;
		document.body.style.position = 'fixed';
		document.body.style.top = `-${savedScrollY}px`;
		document.body.style.left = '0';
		document.body.style.right = '0';
		document.body.style.overflow = 'hidden';
	}

	function unlockScroll() {
		cancelPendingUnlock = undefined;
		didLock = false;
		document.body.style.position = '';
		document.body.style.top = '';
		document.body.style.left = '';
		document.body.style.right = '';
		document.body.style.overflow = '';
		// Also clears any pan iOS left behind for the keyboard, which otherwise
		// strands fixed elements like the bottom nav above the screen's edge.
		window.scrollTo(0, savedScrollY);
	}

	// Unlocking while the keyboard is still on screen restores the scroll
	// position before iOS has undone its keyboard pan, and the page stays
	// shifted. Dismiss the keyboard first and unlock once it has gone.
	function unlockAfterKeyboard() {
		const active = document.activeElement;
		if (active instanceof HTMLElement && sheetElement?.contains(active)) active.blur();

		const vv = window.visualViewport;
		const keyboardUp = (vv: VisualViewport) => window.innerHeight - vv.height > 150;
		if (!vv || !keyboardUp(vv)) {
			unlockScroll();
			return;
		}

		const onResize = () => {
			if (!keyboardUp(vv)) done();
		};
		const fallback = setTimeout(() => done(), 600);
		const cleanup = () => {
			clearTimeout(fallback);
			vv.removeEventListener('resize', onResize);
		};
		const done = () => {
			cleanup();
			unlockScroll();
		};
		vv.addEventListener('resize', onResize);
		cancelPendingUnlock = cleanup;
	}

	$effect(() => {
		if (open) {
			if (cancelPendingUnlock) {
				// Reopened before the previous close finished unlocking: the
				// original lock (and its saved scroll position) is still in place.
				cancelPendingUnlock();
				cancelPendingUnlock = undefined;
			} else {
				lockScroll();
			}
		} else if (didLock && !cancelPendingUnlock) {
			// Only unlock a lock we actually took. This effect also runs on mount
			// with `open` false, and unconditionally restoring would clear styles
			// we never set and scroll the page to 0 — visible on any page that
			// mounts a closed sheet, and the Library mounts three.
			unlockAfterKeyboard();
		}
	});
</script>

{#if open}
	<div
		class="fixed inset-x-0 top-0 z-1000 flex h-full items-end"
		style={viewport ? `top: ${viewport.top}px; height: ${viewport.height}px;` : undefined}
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
			class="bg-base-100 relative flex w-full flex-col rounded-t-3xl shadow-2xl"
			style="max-height: {maxHeights[
				size
			]}; padding-bottom: env(safe-area-inset-bottom, 0px); touch-action: pan-y;"
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
