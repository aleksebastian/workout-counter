<script lang="ts">
	import { holdRepeat } from '$lib/actions/holdRepeat';

	/**
	 * A − or + that repeats while held, for the set cards (SetAdjuster,
	 * MeasureEntry). Always 44pt tall: it's hit mid-workout, one-handed, often
	 * with chalk or sweat on the thumb. Its width follows the nearest size
	 * container (the card): 36pt on a card under 22rem, 44pt from there.
	 * `compact` keeps it at 36pt, for a reps pair that should sit right beside
	 * its number instead of reaching across to the next column.
	 *
	 * The hold is a long press as far as iOS is concerned, so the button
	 * turns off text selection and the Copy / Look Up callout.
	 */

	interface Props {
		/** Spoken name, e.g. "Increase weight by 2.5". */
		label: string;
		kind: 'decrease' | 'increase';
		action: () => void;
		compact?: boolean;
	}

	let { label, kind, action, compact = false }: Props = $props();
</script>

<button
	class="btn btn-ghost hover:bg-base-300 h-11 min-h-0 rounded-full border-none px-0 shadow-none select-none [-webkit-touch-callout:none] {compact
		? 'w-9'
		: 'w-9 @min-[22rem]:w-11'}"
	use:holdRepeat={action}
	aria-label={label}
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-4 w-4"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2.5"
		aria-hidden="true"
		><path stroke-linecap="round" d={kind === 'increase' ? 'M12 5v14M5 12h14' : 'M5 12h14'} /></svg
	>
</button>
