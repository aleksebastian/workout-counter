<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import SegmentedTabs from '$lib/components/SegmentedTabs.svelte';
	import { toaster } from '$lib/toast.svelte';
	import {
		BugReportError,
		collectDiagnostics,
		submitBugReport,
		type BugReportCategory
	} from '$lib/bugReport';

	interface Props {
		open?: boolean;
		/** The page the report is about — the one under the account screen. */
		route: string;
	}

	let { open = $bindable(false), route }: Props = $props();

	const MIN = 10;
	const MAX = 4000;
	const CATEGORIES = [
		{ id: 'bug', label: 'Bug' },
		{ id: 'suggestion', label: 'Suggestion' },
		{ id: 'other', label: 'Other' }
	] as const;

	let category = $state<BugReportCategory>('bug');
	let description = $state('');
	let error = $state<string | undefined>(undefined);
	let sending = $state(false);

	// Reseed on open so a sent report doesn't linger. A failed send keeps its
	// text until the sheet is closed and reopened.
	$effect(() => {
		if (open) {
			category = 'bug';
			description = '';
		}
		error = undefined;
	});

	async function send() {
		const text = description.trim();
		if (text.length < MIN) {
			error = 'Tell us a little more — at least a sentence.';
			return;
		}
		sending = true;
		try {
			await submitBugReport({
				category,
				description: text,
				diagnostics: collectDiagnostics(route)
			});
			open = false;
			toaster.show({ type: 'success', message: 'Thanks — report sent' });
		} catch (e) {
			const status = e instanceof BugReportError ? e.status : 0;
			toaster.show({
				id: 'bug-report-failed',
				type: 'error',
				message:
					status === 429
						? 'You just sent one — try again in a minute'
						: "Couldn't send the report. Try again."
			});
		} finally {
			sending = false;
		}
	}
</script>

<BottomSheet bind:open size="large" title="Report a bug" autofocus={false}>
	<div class="flex flex-col gap-4">
		<SegmentedTabs tabs={CATEGORIES} current={category} onSelect={(id) => (category = id)} />

		<div class="flex flex-col gap-2">
			<textarea
				aria-label="What happened?"
				class="textarea textarea-bordered min-h-36 w-full text-base"
				class:textarea-error={!!error}
				placeholder={category === 'suggestion'
					? 'What would make SetCount better?'
					: 'What happened, and what did you expect?'}
				maxlength={MAX}
				bind:value={description}
				oninput={() => (error = undefined)}></textarea>
			{#if error}
				<p class="text-error text-sm">{error}</p>
			{:else}
				<p class="text-base-content/40 text-xs">
					Reports are posted publicly on GitHub, so leave out personal info. The app version and
					device details are attached.
				</p>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<div class="flex gap-2">
			<button class="btn btn-ghost flex-1" onclick={() => (open = false)}>Cancel</button>
			<button class="btn btn-primary flex-1" disabled={sending} onclick={send}>
				{#if sending}<span class="loading loading-spinner loading-sm"></span>{/if}
				Send
			</button>
		</div>
	{/snippet}
</BottomSheet>
