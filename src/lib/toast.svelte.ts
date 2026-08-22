import { v4 as uuidv4 } from 'uuid';
import type { Toast } from '$lib/types';

export type ValorizedToast = Toast & { id: string; timeout: number; dismissible: boolean };

let toasts = $state<ValorizedToast[]>([]);

export const toaster = {
	get items() {
		return toasts;
	},
	show(toast: Toast) {
		const id = toast.id ?? uuidv4();
		// De-dupe: a caller can pass a stable id so a repeated failure doesn't stack.
		if (toasts.some((t) => t.id === id)) return;

		const next: ValorizedToast = {
			dismissible: false,
			timeout: 3000,
			...toast,
			id
		};
		toasts.unshift(next);

		if (next.timeout) {
			setTimeout(() => this.dismiss(id), next.timeout);
		}
	},
	error(message: string, id?: string) {
		this.show({ type: 'error', message, dismissible: true, id });
	},
	success(message: string) {
		this.show({ type: 'success', message });
	},
	dismiss(id: string) {
		toasts = toasts.filter((t) => t.id !== id);
	}
};
