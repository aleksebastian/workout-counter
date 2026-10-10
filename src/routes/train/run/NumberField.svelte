<script lang="ts">
	/**
	 * A big typeable number that sizes to its contents.
	 *
	 * What's typed stays as typed until the field loses focus. Writing the
	 * parsed number back on every keystroke turned "102." into "102", and
	 * WebKit then put the caret at the start, so the next backspace did
	 * nothing; and a type=number field reports partial input like "102." as
	 * empty. A text field with a numeric keypad avoids both.
	 */

	interface Props {
		value: number;
		label: string;
		mode: 'numeric' | 'decimal';
		onchange: (n: number) => void;
	}

	let { value, label, mode, onchange }: Props = $props();

	let text = $state('');
	let editing = $state(false);

	// Follow the value (steppers, a new exercise) except while being typed in.
	$effect(() => {
		const current = String(value);
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

	function input(e: Event) {
		text = (e.currentTarget as HTMLInputElement).value.replace(',', '.');
		const n = Number(text);
		if (text.trim() !== '' && Number.isFinite(n)) onchange(n);
	}
</script>

<input
	type="text"
	inputmode={mode}
	autocomplete="off"
	aria-label={label}
	class="min-w-0 bg-transparent leading-none font-black tabular-nums outline-none {size}"
	style:width="{width}ch"
	value={text}
	oninput={input}
	onfocus={(e) => {
		editing = true;
		e.currentTarget.select();
	}}
	onblur={() => {
		editing = false;
		text = String(value);
	}}
/>
