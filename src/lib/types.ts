/**
 * Domain types. Kept free of runes and Firebase imports so they can be shared
 * by the client, the server routes and the test seeder without pulling in a
 * browser runtime.
 */

/** How an exercise is measured. Without one, it's reps and weight. */
export type Measure = 'reps' | 'time' | 'distance' | 'hold';

export const MEASURES: readonly Measure[] = ['reps', 'time', 'distance', 'hold'];

export type Set = {
	id: string;
	date: string;
	/** 0 for time and distance sets. */
	reps: number;
	weight?: number;
	/** Time and distance sets: how long it took, in whole seconds. */
	seconds?: number;
	/** Distance sets, in meters whatever unit they were entered in. */
	meters?: number;
	/** Hold sets: how long each rep was held, in seconds. */
	holdSeconds?: number;
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
	/** How its sets are measured; none means reps and weight. */
	measure?: Measure;
	sets: Set[];
	notes?: string;
	source?: Source;
	/** Epoch ms — gives the subcollection a stable insertion order. */
	createdAt: number;
};

export type Duration = { minutes: number; seconds: number };

/** What a set should reach for an exercise measured by time, distance or a hold. */
export type MeasureTargets = {
	/** Time and distance: how long each set should last. */
	targetSeconds?: number;
	/** Distance: how far each set should go, in meters. */
	targetMeters?: number;
	/** Hold: how long each rep is held, in seconds. */
	holdSeconds?: number;
};

export type RoutineExercise = MeasureTargets & {
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
	| ({ type: 'exercise'; workoutId: string; targetSets: number } & MeasureTargets);

/** When in the day a session happens. Only orders and labels sessions; there are no clock times. */
export type Slot = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

export const SLOTS: readonly Slot[] = ['morning', 'midday', 'afternoon', 'evening', 'night'];

export const SLOT_LABEL: Record<Slot, string> = {
	morning: 'Morning',
	midday: 'Midday',
	afternoon: 'Afternoon',
	evening: 'Evening',
	night: 'Night'
};

/** What a session without a slot is called once its day has others to order it against. */
export const ANYTIME = 'Anytime';

/** The slot the clock is in: Morning before 11, Midday to 2, Afternoon to 5, Evening to 9, then Night. */
export function currentSlot(now: Date = new Date()): Slot {
	const h = now.getHours();
	if (h < 11) return 'morning';
	if (h < 14) return 'midday';
	if (h < 17) return 'afternoon';
	if (h < 21) return 'evening';
	return 'night';
}

/** Sort key for a slot; one without a slot goes after all of them. */
export function slotRank(slot: Slot | undefined): number {
	return slot ? SLOTS.indexOf(slot) : SLOTS.length;
}

/** One guided workout within a program day, e.g. Morning cardio or the Evening lift. */
export type ProgramSession = {
	id: string;
	slot?: Slot;
	label?: string; // optional custom label e.g. "Upper Hypertrophy"
	items: ProgramItem[];
};

export type ProgramDay = {
	day: number; // 0=Sun … 6=Sat
	sessions: ProgramSession[];
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

/**
 * A day's sessions that have something in them, in slot order: Morning
 * first, sessions without a slot last, ties kept in the order they were added.
 */
export function daySessions(day: ProgramDay | null | undefined): ProgramSession[] {
	return orderedSessions(day).filter((s) => s.items.length > 0);
}

/** Every session in a day, empty ones too (the editor shows them), in slot order. */
export function orderedSessions(day: ProgramDay | null | undefined): ProgramSession[] {
	return (day?.sessions ?? [])
		.map((s, i) => ({ s, i }))
		.sort((a, b) => slotRank(a.s.slot) - slotRank(b.s.slot) || a.i - b.i)
		.map(({ s }) => s);
}

/** What a session's slot is called in a list: its slot, or Anytime. */
export function slotLabel(slot: Slot | undefined): string {
	return slot ? SLOT_LABEL[slot] : ANYTIME;
}

/** Sessions scheduled for one day of the week, in slot order. */
export function sessionsForDay(program: Program, day: number): ProgramSession[] {
	return daySessions(program.schedule.find((d) => d.day === day));
}

export function sessionOf(program: Program, day: number, sessionId: string): ProgramSession | null {
	return (
		program.schedule.find((d) => d.day === day)?.sessions.find((s) => s.id === sessionId) ?? null
	);
}

/** Days of the week that have at least one scheduled item. */
export function programDays(program: Program): number[] {
	return program.schedule.filter((d) => daySessions(d).length > 0).map((d) => d.day);
}

/** Everything scheduled for one day of the week, across its sessions. */
export function itemsForDay(program: Program, day: number): ProgramItem[] {
	return sessionsForDay(program, day).flatMap((s) => s.items);
}

/** The next day after `fromDay`, wrapping round the week, with anything scheduled; `null` if none. */
export function nextScheduledDay(program: Program, fromDay: number): ProgramDay | null {
	for (let i = 1; i <= 7; i++) {
		const day = (fromDay + i) % 7;
		const entry = program.schedule.find((d) => d.day === day && daySessions(d).length > 0);
		if (entry) return entry;
	}
	return null;
}

// ── Training sessions ────────────────────────────────────────────────────────

/** What a guided session is running: one routine, or one session of a program day. */
export type SessionSource =
	| { type: 'routine'; routineId: string }
	| { type: 'program'; programId: string; day: number; sessionId: string };

/**
 * A running stopwatch for a time or distance set. Kept with the workout in
 * progress and counted from the clock, so it keeps going while the app is
 * closed and carries across devices.
 */
export type SetTimer = {
	workoutId: string;
	/** Epoch ms of the tap on Start. */
	startedAt: number;
	/** Time spent paused before now, in ms. */
	pausedMs: number;
	/** Epoch ms it was paused at, while paused. */
	pausedAt?: number;
};

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
	/**
	 * Time spent ended before being resumed, in ms. Elapsed time and the
	 * duration leave it out, so a resumed workout doesn't count the break.
	 */
	pausedMs: number;
	/** The stopwatch for the current time or distance set, while one is running or paused. */
	timer?: SetTimer;
};

/**
 * The workout that ended most recently, kept on the user document so it can
 * be resumed later the same day. Its sets are still the ones logged since
 * `startedAt`, so resuming only has to restore this.
 */
export type EndedSession = Omit<ActiveSession, 'lastActiveAt'> & {
	/** Epoch ms; for an abandoned workout, its last activity. */
	endedAt: number;
	/** Every planned exercise got its sets. */
	complete: boolean;
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
	/** Every planned exercise got its sets; false when it ended early. */
	complete: boolean;
	/** Time it spent ended before being resumed; the duration is end − start − this. */
	pausedMs?: number;
	/** Time and distance sets add up their seconds and meters too. */
	exercises: {
		workoutId: string;
		name: string;
		sets: number;
		reps: number;
		seconds?: number;
		meters?: number;
	}[];
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
	/** Follows the weight unit (kg → km, lbs → mi) until it's chosen. */
	distanceUnit: 'km' | 'mi';
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
	lastSession?: EndedSession | null;
};

export type Toast = {
	id?: string;
	type: 'info' | 'success' | 'error' | 'warning';
	message: string;
	dismissible?: boolean;
	timeout?: number;
	/** One button beside the message, e.g. Undo; tapping it also dismisses the toast. */
	action?: { label: string; onClick: () => void };
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
	measure: MEASURES.includes(raw.measure as Measure) ? (raw.measure as Measure) : undefined,
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
	// Each session's `items` is coerced too: `programDays` reads `s.items.length`,
	// so a schedule containing a malformed session would still throw.
	schedule: arrayOf<RawDoc>(raw.schedule).map((day) => ({
		day: num(day?.day),
		sessions: arrayOf<RawDoc>(day?.sessions).map(parseProgramSession)
	})),
	source: source(raw.source),
	createdAt: num(raw.createdAt)
});

/** An unknown slot is dropped, which lists the session as Anytime. */
function parseProgramSession(raw: RawDoc | null | undefined): ProgramSession {
	const slot = raw?.slot as Slot;
	const label = str(raw?.label);
	return {
		id: str(raw?.id),
		...(SLOTS.includes(slot) && { slot }),
		...(label && { label }),
		items: arrayOf<ProgramItem>(raw?.items)
	};
}

function sessionSource(value: unknown): SessionSource | null {
	const raw = (value ?? {}) as RawDoc;
	if (raw.type === 'routine' && typeof raw.routineId === 'string') {
		return { type: 'routine', routineId: raw.routineId };
	}
	if (
		raw.type === 'program' &&
		typeof raw.programId === 'string' &&
		typeof raw.sessionId === 'string'
	) {
		return {
			type: 'program',
			programId: raw.programId,
			day: num(raw.day),
			sessionId: raw.sessionId
		};
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
		currentIndex: num(raw.currentIndex),
		pausedMs: num(raw.pausedMs),
		...(parseTimer(raw.timer) && { timer: parseTimer(raw.timer)! })
	};
}

/** A timer missing its exercise or start is treated as none. */
function parseTimer(value: unknown): SetTimer | null {
	const raw = (value ?? {}) as RawDoc;
	if (typeof raw.workoutId !== 'string' || typeof raw.startedAt !== 'number') return null;
	return {
		workoutId: raw.workoutId,
		startedAt: raw.startedAt,
		pausedMs: num(raw.pausedMs),
		...(typeof raw.pausedAt === 'number' && { pausedAt: raw.pausedAt })
	};
}

/** An ended session that can't be resumed (unknown source, no id) is treated as none. */
export function parseEndedSession(value: unknown): EndedSession | null {
	const active = parseActiveSession(value);
	if (!active) return null;
	const raw = value as RawDoc;
	return {
		id: active.id,
		source: active.source,
		name: active.name,
		startedAt: active.startedAt,
		currentWorkoutId: active.currentWorkoutId,
		currentIndex: active.currentIndex,
		pausedMs: active.pausedMs,
		endedAt: num(raw.endedAt, active.startedAt),
		complete: raw.complete === true
	};
}

/** A workout history entry; `null` for one whose source isn't understood. */
export const parseSessionLog: Parse<SessionLog | null> = (raw, id) => {
	const source = sessionSource(raw.source);
	if (!source) return null;
	const startedAt = num(raw.startedAt);
	const totals = (raw.totals ?? {}) as RawDoc;
	return {
		...(raw as SessionLog),
		id: str(raw.id, id),
		source,
		name: str(raw.name),
		startedAt,
		endedAt: num(raw.endedAt, startedAt),
		endReason: raw.endReason === 'abandoned' ? 'abandoned' : 'finished',
		complete: raw.complete === true,
		exercises: arrayOf<SessionLog['exercises'][number]>(raw.exercises),
		totals: { sets: num(totals.sets), reps: num(totals.reps) },
		createdAt: num(raw.createdAt)
	};
};

export const parseUserData: Parse<UserData> = (raw) => ({
	...(raw as UserData),
	activeSession: parseActiveSession(raw.activeSession),
	lastSession: parseEndedSession(raw.lastSession)
});
