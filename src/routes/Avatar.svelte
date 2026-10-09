<script lang="ts">
	import { getUserInitials } from '$lib/utils';
	import type { User } from 'firebase/auth';
	import { page } from '$app/state';
	import { pushState } from '$app/navigation';

	interface Props {
		hasUser: boolean;
		user: User | null;
	}

	// The account screen itself renders from the layout, outside the navbar.
	let { hasUser, user }: Props = $props();

	// A history entry rather than local state, so back closes the screen.
	function openAccount() {
		if (!page.state.account) pushState('', { account: true });
	}
</script>

{#if hasUser}
	<button
		class="btn btn-circle bg-neutral text-neutral-content"
		onclick={openAccount}
		aria-haspopup="dialog"
		aria-expanded={!!page.state.account}
		aria-label="Account"
	>
		<div class="avatar placeholder">
			{#if user}
				<span>{getUserInitials(user)}</span>
			{/if}
		</div>
	</button>
{:else}
	<div tabindex="-1" class="btn btn-circle bg-neutral text-neutral-content invisible"></div>
{/if}
