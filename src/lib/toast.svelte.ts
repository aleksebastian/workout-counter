import { untrack } from 'svelte';
import { v4 as uuidv4 } from 'uuid';
import type { Toast } from '$lib/types';

export type ValorizedToast = Toast & { id: string; timeout: number; dismissible: boolean };

let toasts = $state<ValorizedToast[]>([]);

export const toaster = {
	get items() {
		return toasts;
	},

	/**
	 * Showing a toast must never make the caller reactive to the toast list.
	 *
	 * Reading `toasts` here — even just to de-dupe — subscribes whatever effect
	 * is running to the array's `length`, and pushing then invalidates it. An
	 * effect that shows a toast would re-run itself forever
	 * (`effect_update_depth_exceeded`). `untrack` keeps both the read and the
	 * write outside the caller's dependency graph, so `toaster` is safe to call
	 * from an `$effect`, a `$derived` or an event handler alike.
	 */
	show(toast: Toast) {
		untrack(() => {
			const id = toast.id ?? uuidv4();
			// De-dupe: a caller can pass a stable id so a repeated failure doesn't stack.
			if (toasts.some((t) => t.id === id)) return;

			toasts.unshift({
				dismissible: false,
				timeout: 3000,
				...toast,
				id
			});

			const { timeout } = toasts[0];
			if (timeout) setTimeout(() => this.dismiss(id), timeout);
		});
	},

	error(message: string, id?: string) {
		this.show({ type: 'error', message, dismissible: true, id });
	},

	success(message: string) {
		this.show({ type: 'success', message });
	},

	dismiss(id: string) {
		untrack(() => {
			toasts = toasts.filter((t) => t.id !== id);
		});
	}
};
