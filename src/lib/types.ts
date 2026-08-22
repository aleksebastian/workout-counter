/**
 * Domain types. Kept free of runes and Firebase imports so they can be shared
 * by the client, the server routes and the test seeder without pulling in a
 * browser runtime.
 */

export type Set = {
	id: string;
	date: string;
	reps: number;
	weight?: number;
	notes?: string;
};

export type Workout = {
	id: string;
	name: string;
	sets: Set[];
	notes?: string;
	/** Epoch ms — gives the subcollection a stable insertion order. */
	createdAt: number;
};

export type Duration = { minutes: number; seconds: number };

export type RoutineExercise = {
	workoutId: string;
	targetSets?: number; // undefined = free-form (user advances manually)
	minReps?: number;
	maxReps?: number;
};

export type Routine = {
	id: string;
	name: string;
	exercises: RoutineExercise[];
	timer?: Duration;
	notes?: string;
	/** Epoch ms — gives the subcollection a stable insertion order. */
	createdAt: number;
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
	notes?: string;
	schedule: ProgramDay[];
	/** Epoch ms — gives the subcollection a stable insertion order. */
	createdAt: number;
};

/** Days of the week that have at least one scheduled item. */
export function programDays(program: Program): number[] {
	return program.schedule.filter((d) => d.items.length > 0).map((d) => d.day);
}

/** Items scheduled for one day of the week. */
export function itemsForDay(program: Program, day: number): ProgramItem[] {
	return program.schedule.find((d) => d.day === day)?.items ?? [];
}

export type Preferences = {
	timer: Duration;
	theme: 'light' | 'dark' | 'system';
	weightUnit: 'lbs' | 'kg';
	weekStart: 0 | 1;
	weeklyGoal: number;
	streaksEnabled: boolean;
};

export type UserData = {
	username: string;
	photoURL: string;
	activeProgramId?: string | null;
	preferences?: Partial<Preferences>;
};

export type Toast = {
	id?: string;
	type: 'info' | 'success' | 'error' | 'warning';
	message: string;
	dismissible?: boolean;
	timeout?: number;
};
