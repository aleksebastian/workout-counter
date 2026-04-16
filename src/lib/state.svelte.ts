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

export type RoutineExercise = {
	workoutId: string;
	targetSets?: number; // undefined = free-form (user advances manually)
	minReps?: number; // minimum reps in range (e.g., 4)
	maxReps?: number; // maximum reps in range (e.g., 6)
};

export type Routine = {
	id: string;
	name: string;
	exercises: RoutineExercise[];
};

export function getRoutineExercises(routine: Routine): RoutineExercise[] {
	return routine.exercises;
}

export type ProgramExercise = {
	workoutId: string;
	targetSets: number;
};

export type ProgramItem =
	| { type: 'routine'; routineId: string }
	| { type: 'exercise'; workoutId: string; targetSets: number };

export type ProgramDay = {
	day: number; // 0=Sun … 6=Sat
	label?: string; // optional custom label e.g. "Upper Hypertrophy"
	items: ProgramItem[];
};

export type Program = {
	id: string;
	name: string;
	schedule?: ProgramDay[]; // new: per-day items; source of truth when present
	// Backward-compat fields:
	days?: number[];
	exercises?: ProgramExercise[];
	items?: ProgramItem[];
};

/** Returns the full weekly schedule, normalising legacy flat-items data. */
export function getProgramSchedule(program: Program): ProgramDay[] {
	if (program.schedule?.length) return program.schedule;
	const items: ProgramItem[] = program.items
		? program.items
		: (program.exercises ?? []).map((e) => ({
				type: 'exercise' as const,
				workoutId: e.workoutId,
				targetSets: e.targetSets
			}));
	return (program.days ?? []).map((day) => ({ day, items }));
}

/** Returns all days that have scheduled items. */
export function getProgramDays(program: Program): number[] {
	if (program.schedule) return program.schedule.map((sd) => sd.day);
	return program.days ?? [];
}

/** Returns items for a specific day of the week. */
export function getProgramItemsForDay(program: Program, day: number): ProgramItem[] {
	return getProgramSchedule(program).find((sd) => sd.day === day)?.items ?? [];
}

/**
 * Returns a flat item list — for today if scheduled, else the first day.
 * Kept for backward compat with legacy callers.
 */
export function getProgramItems(program: Program): ProgramItem[] {
	if (program.schedule?.length) {
		const today = new Date().getDay();
		const sd = program.schedule.find((sd) => sd.day === today) ?? program.schedule[0];
		return sd?.items ?? [];
	}
	if (program.items) return program.items;
	return (program.exercises ?? []).map((e) => ({
		type: 'exercise' as const,
		workoutId: e.workoutId,
		targetSets: e.targetSets
	}));
}

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

export const navState = $state<{ title: string; backHref: string }>({ title: '', backHref: '/' });

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
