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

/**
 * Where a library item came from, when it wasn't built from scratch. Stamped
 * when something is added from the Explore catalog, so a later add can match
 * it by id instead of guessing from its (editable) name.
 */
export type Source = { catalogId: string };

export type Workout = {
	id: string;
	name: string;
	sets: Set[];
	notes?: string;
	source?: Source;
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
	source?: Source;
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
	source?: Source;
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

// ── Training sessions ────────────────────────────────────────────────────────

/** What a guided session is running: one routine, or one day of a program. */
export type SessionSource =
	| { type: 'routine'; routineId: string }
	| { type: 'program'; programId: string; day: number };

/**
 * The workout in progress, kept on the user document so it survives leaving
 * the screen, closing the app, and switching devices. Its sets are the ones
 * logged since `startedAt`, so nothing about them is duplicated here.
 */
export type ActiveSession = {
	id: string;
	source: SessionSource;
	/** Snapshot of the routine/program name, for when the source is renamed or deleted. */
	name: string;
	/** Epoch ms. */
	startedAt: number;
	/** Epoch ms of the last start or move between exercises (sets carry their own times). */
	lastActiveAt: number;
	/**
	 * The exercise the user is on. Kept by id so editing the plan mid-workout
	 * doesn't move them; `currentIndex` is the fallback if it leaves the plan.
	 */
	currentWorkoutId: string | null;
	currentIndex: number;
};

/** A finished (or abandoned) session, kept as workout history. */
export type SessionLog = {
	id: string;
	source: SessionSource;
	name: string;
	startedAt: number;
	endedAt: number;
	/** `abandoned`: closed automatically after inactivity; `endedAt` is the last activity. */
	endReason: 'finished' | 'abandoned';
	exercises: { workoutId: string; name: string; sets: number; reps: number }[];
	totals: { sets: number; reps: number };
	/** Epoch ms — gives the subcollection a stable insertion order. */
	createdAt: number;
};

export type Preferences = {
	/** The global rest timer's duration. Used only when `timerEnabled`. */
	timer: Duration;
	/** Whether the global rest timer runs. Routine timers apply regardless. */
	timerEnabled: boolean;
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
	activeSession?: ActiveSession | null;
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

/** A malformed provenance stamp is dropped rather than trusted. */
function source(value: unknown): Source | undefined {
	const id = (value as RawDoc | null | undefined)?.catalogId;
	return typeof id === 'string' && id ? { catalogId: id } : undefined;
}

export const parseWorkout: Parse<Workout> = (raw, id) => ({
	...(raw as Workout),
	id: str(raw.id, id),
	name: str(raw.name),
	sets: arrayOf<Set>(raw.sets),
	source: source(raw.source),
	createdAt: num(raw.createdAt)
});

export const parseRoutine: Parse<Routine> = (raw, id) => ({
	...(raw as Routine),
	id: str(raw.id, id),
	name: str(raw.name),
	exercises: arrayOf<RoutineExercise>(raw.exercises),
	source: source(raw.source),
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
	source: source(raw.source),
	createdAt: num(raw.createdAt)
});

function sessionSource(value: unknown): SessionSource | null {
	const raw = (value ?? {}) as RawDoc;
	if (raw.type === 'routine' && typeof raw.routineId === 'string') {
		return { type: 'routine', routineId: raw.routineId };
	}
	if (raw.type === 'program' && typeof raw.programId === 'string') {
		return { type: 'program', programId: raw.programId, day: num(raw.day) };
	}
	return null;
}

/** A session that can't be resumed (unknown source, no id) is treated as none. */
export function parseActiveSession(value: unknown): ActiveSession | null {
	if (!value || typeof value !== 'object') return null;
	const raw = value as RawDoc;
	const source = sessionSource(raw.source);
	const id = str(raw.id);
	if (!source || !id) return null;
	const startedAt = num(raw.startedAt);
	return {
		id,
		source,
		name: str(raw.name),
		startedAt,
		lastActiveAt: num(raw.lastActiveAt, startedAt),
		currentWorkoutId: typeof raw.currentWorkoutId === 'string' ? raw.currentWorkoutId : null,
		currentIndex: num(raw.currentIndex)
	};
}

export const parseUserData: Parse<UserData> = (raw) => ({
	...(raw as UserData),
	activeSession: parseActiveSession(raw.activeSession)
});
