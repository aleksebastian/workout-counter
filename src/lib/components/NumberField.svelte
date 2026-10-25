<script lang="ts">
	/**
	 * A big typeable number that sizes to its contents.
	 *
	 * What's typed stays as typed until the field loses focus. Writing the
	 * parsed number back on every keystroke turned "102." into "102", and
	 * WebKit then put the caret at the start, so the next backspace did
	 * nothing; and a type=number field reports partial input like "102." as
	 * empty. A text field with a numeric keypad avoids both.
	 *
	 * Tapping it highlights the number, so whatever is typed replaces it.
	 */

	interface Props {
		value: number;
		label: string;
		mode: 'numeric' | 'decimal';
		onchange: (n: number) => void;
		/** Shown with at least this many digits, e.g. 2 for the seconds of "1:05". */
		digits?: number;
	}

	let { value, label, mode, onchange, digits = 1 }: Props = $props();

	const shown = (n: number) => String(n).padStart(digits, '0');

	let text = $state('');
	let editing = $state(false);
	/**
	 * Just focused: the next keystroke replaces the number rather than adding
	 * to it. Shown with a highlight of our own — iOS hides the real selection
	 * while the screen refits around the keyboard.
	 */
	let fresh = $state(false);

	// Follow the value (steppers, a new exercise) except while being typed in.
	$effect(() => {
		const current = shown(value);
		if (!editing) text = current;
	});

	// Digits are tabular (1ch each); a decimal point is much narrower.
	let width = $derived.by(() => {
		const points = text.split('.').length - 1;
		return Math.max(1, text.length - points) + points * 0.35 + 0.15;
	});

	// A longer number steps down a size, so "135" or "102.5" still fits
	// beside its buttons in half the card.
	let size = $derived.by(() => {
		const digits = text.replace('.', '').length;
		return digits <= 2 ? 'text-4xl' : digits === 3 ? 'text-3xl' : 'text-2xl';
	});

	function commit(next: string) {
		text = next.replace(',', '.');
		const n = Number(text);
		if (text.trim() !== '' && Number.isFinite(n)) onchange(n);
	}

	function input(e: Event) {
		fresh = false;
		commit((e.currentTarget as HTMLInputElement).value);
	}

	function focus(e: FocusEvent) {
		const el = e.currentTarget as HTMLInputElement;
		editing = true;
		fresh = true;
		el.select();
		// iOS places the caret where the tap landed after focusing, which drops
		// the selection; select again once it has.
		setTimeout(() => {
			if (fresh && document.activeElement === el) el.setSelectionRange(0, el.value.length);
		});
	}

	// The highlight can still be lost (a second tap, a long press), so the
	// first keystroke after focusing replaces the number either way, and the
	// first backspace clears it.
	function beforeInput(e: InputEvent) {
		if (!fresh) return;
		fresh = false;
		const el = e.currentTarget as HTMLInputElement;
		if (e.inputType === 'insertText' && e.data) {
			e.preventDefault();
			el.value = e.data;
			commit(e.data);
		} else if (e.inputType.startsWith('delete')) {
			e.preventDefault();
			el.value = '';
			commit('');
		}
	}
</script>

<input
	type="text"
	inputmode={mode}
	autocomplete="off"
	aria-label={label}
	class="-mx-1 min-w-0 rounded-lg px-1 leading-none font-black tabular-nums transition-colors outline-none {size}"
	class:bg-transparent={!fresh}
	class:fresh
	style:width="calc({width}ch + 0.5rem)"
	value={text}
	oninput={input}
	onbeforeinput={beforeInput}
	onfocus={focus}
	onblur={() => {
		editing = false;
		fresh = false;
		text = shown(value);
	}}
/>

<style>
	/* The number is selected: the next key replaces it. */
	.fresh {
		background-color: color-mix(in oklab, var(--color-primary) 30%, transparent);
		caret-color: transparent;
	}

	/* iOS's own (hidden or not) selection shouldn't double up on ours. */
	.fresh::selection {
		background: transparent;
	}
</style>
