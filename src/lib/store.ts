import { get, writable, type Writable } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';

export type Set = {
	id: string;
	date: string;
	reps: number;
};

export type Workout = {
	id: string;
	name: string;
	sets: Set[];
};

export type Toast = {
	id?: string;
	type: 'info' | 'success' | 'rest';
	message: string;
	dismissible?: boolean;
	timeout?: number;
};

export type ValorizedToast = Toast & {
	id: string;
	timeout: number;
	dismissible: boolean;
};

export const restTimer$: Writable<string | undefined> = writable(undefined);

export const isMobileDevice$: Writable<boolean> = writable(false);

export const toasts$: Writable<ValorizedToast[]> = writable([]);

export const dismissToast = (id: ValorizedToast['id']) =>
	toasts$.update((toasts) => toasts.filter((toast: ValorizedToast) => toast.id !== id));

export const addToast = (toast: Toast) => {
	if (toast.id === 'rest' && get(toasts$).filter((toast) => toast.id === 'rest').length) {
		return;
	}

	const id = toast?.id ? toast.id : uuidv4();

	const defaults = {
		id,
		type: 'info',
		dismissible: false,
		timeout: 3000
	};

	const newToast = { ...defaults, ...toast };
	toasts$.update((all) => [newToast, ...all]);

	if (toast.timeout) {
		setTimeout(() => {
			dismissToast(id);
		}, toast.timeout);
	}
};
