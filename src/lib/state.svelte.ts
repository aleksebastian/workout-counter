import { v4 as uuidv4 } from 'uuid';

export type Set = {
	id: string;
	date: string;
	reps: number;
	weight?: number;
};

export type Workout = {
	id: string;
	name: string;
	sets: Set[];
};

export type Routine = {
	id: string;
	name: string;
	workoutIds: string[];
};

export type Toast = {
	id?: string;
	type: 'info' | 'success';
	message: string;
	dismissible?: boolean;
	timeout?: number;
};

export type ValorizedToast = Toast & {
	id: string;
	timeout: number;
	dismissible: boolean;
};

export const restTimer = $state<{ value: string | undefined }>({ value: undefined });

let toasts = $state<ValorizedToast[]>([]);
export const toaster = {
	getToasts() {
		return toasts;
	},
	addToast(toast: Toast) {
		const id = toast?.id ? toast.id : uuidv4();

		const defaults = {
			id,
			type: 'info',
			dismissible: false,
			timeout: 3000
		};

		const newToast = { ...defaults, ...toast };
		toasts.unshift(newToast);

		if (toast.timeout) {
			setTimeout(() => {
				this.dismissToast(id);
			}, toast.timeout);
		}
	},
	dismissToast(id: ValorizedToast['id']) {
		toasts = toasts.filter((toast: ValorizedToast) => toast.id !== id);
	}
};
