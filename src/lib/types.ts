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

// ── Document parsing ─────────────────────────────────────────────────────────

/**
 * Firestore is schemaless, so a stored document is only ever a *claim* about
 * its shape. Documents written by earlier builds of this app are missing fields
 * the types above declare as required — programs predating the weekly schedule
 * have no `schedule` at all, and every `program.schedule.find(...)` in the app
 * throws on them.
 *
 * These parsers run at the store boundary so nothing downstream has to guard.
 * They are deliberately *not* a legacy-shape normaliser: a program with no
 * usable schedule becomes an empty one, it does not get reconstructed from the
 * old `days`/`items`/`exercises` fields.
 *
 * The raw input is typed as a plain record rather than Firestore's
 * `DocumentData` to keep this module free of Firebase imports; `DocumentData`
 * is structurally assignable to it.
 */
type RawDoc = Record<string, unknown>;

export type Parse<T> = (raw: RawDoc, id: string) => T;

function arrayOf<T>(value: unknown): T[] {
	return Array.isArray(value) ? (value as T[]) : [];
}

function str(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export const parseWorkout: Parse<Workout> = (raw, id) => ({
	...(raw as Workout),
	id: str(raw.id, id),
	name: str(raw.name),
	sets: arrayOf<Set>(raw.sets),
	createdAt: num(raw.createdAt)
});

export const parseRoutine: Parse<Routine> = (raw, id) => ({
	...(raw as Routine),
	id: str(raw.id, id),
	name: str(raw.name),
	exercises: arrayOf<RoutineExercise>(raw.exercises),
	createdAt: num(raw.createdAt)
});

export const parseProgram: Parse<Program> = (raw, id) => ({
	...(raw as Program),
	id: str(raw.id, id),
	name: str(raw.name),
	// Each day's `items` is coerced too: `programDays` reads `d.items.length`,
	// so a schedule containing a malformed day would still throw.
	schedule: arrayOf<RawDoc>(raw.schedule).map((day) => ({
		...(day as unknown as ProgramDay),
		day: num(day?.day),
		items: arrayOf<ProgramItem>(day?.items)
	})),
	createdAt: num(raw.createdAt)
});

export const parseUserData: Parse<UserData> = (raw) => raw as UserData;
