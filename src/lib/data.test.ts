import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Set, Workout } from '$lib/types';

const firestore = vi.hoisted(() => ({
	updateDoc: vi.fn(async () => {}),
	arrayRemove: vi.fn((...values: unknown[]) => ({ arrayRemove: values })),
	doc: vi.fn((_db: unknown, ...path: string[]) => path.join('/'))
}));

vi.mock('firebase/firestore', () => ({
	...firestore,
	arrayUnion: vi.fn(),
	deleteDoc: vi.fn(),
	deleteField: vi.fn(),
	setDoc: vi.fn(),
	writeBatch: vi.fn()
}));
vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('$lib/session.svelte', () => ({ session: { uid: 'u1', activeProgramId: null } }));
vi.mock('$lib/toast.svelte', () => ({ toaster: { error: vi.fn() } }));

const { exercises } = await import('./data');

const set = (id: string, reps: number): Set => ({ id, reps, date: '2026-10-19T00:00:00.000Z' });
const workout = (sets: Set[]): Workout => ({ id: 'w1', name: 'Squat', sets, createdAt: 0 });

describe('exercises.removeSet', () => {
	beforeEach(() => vi.clearAllMocks());

	it('removes the set atomically, as the workout holds it now', async () => {
		const edited = set('b', 9);
		await exercises.removeSet(workout([set('a', 8), edited]), 'b');

		expect(firestore.arrayRemove).toHaveBeenCalledWith(edited);
		expect(firestore.updateDoc).toHaveBeenCalledWith('users/u1/workouts/w1', {
			sets: { arrayRemove: [edited] }
		});
	});

	it('does nothing for a set that is already gone', async () => {
		expect(await exercises.removeSet(workout([set('a', 8)]), 'missing')).toBe(true);
		expect(firestore.updateDoc).not.toHaveBeenCalled();
	});
});
