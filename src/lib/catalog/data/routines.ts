import type { CatalogRoutine } from '../types';

export const routines: CatalogRoutine[] = [
	{
		id: 'full-body-a',
		name: 'Full Body A',
		description:
			'A balanced whole-body session built on dumbbells and cables. Pairs with Full Body B.',
		level: 'beginner',
		timer: { minutes: 1, seconds: 30 },
		exercises: [
			{ exerciseId: 'goblet-squat', targetSets: 3, minReps: 8, maxReps: 12 },
			{ exerciseId: 'dumbbell-bench-press', targetSets: 3, minReps: 8, maxReps: 12 },
			{ exerciseId: 'seated-cable-row', targetSets: 3, minReps: 10, maxReps: 12 },
			{ exerciseId: 'dumbbell-romanian-deadlift', targetSets: 3, minReps: 10, maxReps: 12 },
			{ exerciseId: 'lateral-raise', targetSets: 2, minReps: 12, maxReps: 15 }
		]
	},
	{
		id: 'full-body-b',
		name: 'Full Body B',
		description:
			'The second half of a two-day full-body rotation, with machines for the big movers.',
		level: 'beginner',
		timer: { minutes: 1, seconds: 30 },
		exercises: [
			{ exerciseId: 'leg-press', targetSets: 3, minReps: 10, maxReps: 12 },
			{ exerciseId: 'lat-pulldown', targetSets: 3, minReps: 8, maxReps: 12 },
			{ exerciseId: 'dumbbell-shoulder-press', targetSets: 3, minReps: 8, maxReps: 12 },
			{ exerciseId: 'lying-leg-curl', targetSets: 2, minReps: 10, maxReps: 12 },
			{ exerciseId: 'dumbbell-curl', targetSets: 2, minReps: 10, maxReps: 12 },
			{ exerciseId: 'triceps-pushdown', targetSets: 2, minReps: 10, maxReps: 12 }
		]
	},
	{
		id: 'bodyweight-basics',
		name: 'Bodyweight Basics',
		description:
			'No equipment beyond a sturdy table or bar. A full-body session you can do anywhere.',
		level: 'beginner',
		timer: { minutes: 1, seconds: 0 },
		exercises: [
			{ exerciseId: 'bodyweight-squat', targetSets: 3, minReps: 12, maxReps: 20 },
			{ exerciseId: 'incline-push-up', targetSets: 3, minReps: 8, maxReps: 15 },
			{ exerciseId: 'inverted-row', targetSets: 3, minReps: 8, maxReps: 12 },
			{ exerciseId: 'reverse-lunge', targetSets: 2, minReps: 10, maxReps: 12 },
			{ exerciseId: 'glute-bridge', targetSets: 3, minReps: 12, maxReps: 15 },
			{ exerciseId: 'dead-bug', targetSets: 2, minReps: 8, maxReps: 12 }
		]
	},
	{
		id: 'push-day',
		name: 'Push Day',
		description: 'Chest, shoulders and triceps.',
		level: 'intermediate',
		timer: { minutes: 2, seconds: 0 },
		exercises: [
			{ exerciseId: 'barbell-bench-press', targetSets: 4, minReps: 6, maxReps: 10 },
			{ exerciseId: 'overhead-press', targetSets: 3, minReps: 6, maxReps: 10 },
			{ exerciseId: 'incline-dumbbell-press', targetSets: 3, minReps: 8, maxReps: 12 },
			{ exerciseId: 'lateral-raise', targetSets: 3, minReps: 12, maxReps: 15 },
			{ exerciseId: 'triceps-pushdown', targetSets: 3, minReps: 10, maxReps: 12 },
			{ exerciseId: 'overhead-triceps-extension', targetSets: 2, minReps: 10, maxReps: 12 }
		]
	},
	{
		id: 'pull-day',
		name: 'Pull Day',
		description: 'Back, rear delts and biceps.',
		level: 'intermediate',
		timer: { minutes: 2, seconds: 0 },
		exercises: [
			{ exerciseId: 'pull-up', targetSets: 3, minReps: 6, maxReps: 10 },
			{ exerciseId: 'barbell-row', targetSets: 3, minReps: 6, maxReps: 10 },
			{ exerciseId: 'seated-cable-row', targetSets: 3, minReps: 8, maxReps: 12 },
			{ exerciseId: 'face-pull', targetSets: 3, minReps: 12, maxReps: 15 },
			{ exerciseId: 'hammer-curl', targetSets: 3, minReps: 10, maxReps: 12 },
			{ exerciseId: 'dumbbell-curl', targetSets: 2, minReps: 10, maxReps: 12 }
		]
	},
	{
		id: 'leg-day',
		name: 'Leg Day',
		description: 'Quads, hamstrings, glutes and calves, with a core finisher.',
		level: 'intermediate',
		timer: { minutes: 2, seconds: 30 },
		exercises: [
			{ exerciseId: 'back-squat', targetSets: 4, minReps: 6, maxReps: 10 },
			{ exerciseId: 'romanian-deadlift', targetSets: 3, minReps: 8, maxReps: 10 },
			{ exerciseId: 'leg-press', targetSets: 3, minReps: 10, maxReps: 12 },
			{ exerciseId: 'lying-leg-curl', targetSets: 3, minReps: 10, maxReps: 12 },
			{ exerciseId: 'standing-calf-raise', targetSets: 4, minReps: 10, maxReps: 15 },
			{ exerciseId: 'hanging-leg-raise', targetSets: 3, minReps: 10, maxReps: 15 }
		]
	},
	{
		id: 'upper-body',
		name: 'Upper Body',
		description: 'Heavy presses and rows first, arms to finish.',
		level: 'intermediate',
		timer: { minutes: 2, seconds: 0 },
		exercises: [
			{ exerciseId: 'barbell-bench-press', targetSets: 4, minReps: 6, maxReps: 8 },
			{ exerciseId: 'barbell-row', targetSets: 4, minReps: 6, maxReps: 8 },
			{ exerciseId: 'overhead-press', targetSets: 3, minReps: 8, maxReps: 10 },
			{ exerciseId: 'lat-pulldown', targetSets: 3, minReps: 8, maxReps: 12 },
			{ exerciseId: 'dumbbell-curl', targetSets: 2, minReps: 10, maxReps: 12 },
			{ exerciseId: 'triceps-pushdown', targetSets: 2, minReps: 10, maxReps: 12 }
		]
	},
	{
		id: 'lower-body',
		name: 'Lower Body',
		description: 'Squat and hinge, then single-leg and isolation work.',
		level: 'intermediate',
		timer: { minutes: 2, seconds: 30 },
		exercises: [
			{ exerciseId: 'back-squat', targetSets: 4, minReps: 6, maxReps: 8 },
			{ exerciseId: 'romanian-deadlift', targetSets: 3, minReps: 8, maxReps: 10 },
			{ exerciseId: 'bulgarian-split-squat', targetSets: 3, minReps: 8, maxReps: 12 },
			{ exerciseId: 'leg-extension', targetSets: 2, minReps: 12, maxReps: 15 },
			{ exerciseId: 'lying-leg-curl', targetSets: 2, minReps: 10, maxReps: 12 },
			{ exerciseId: 'standing-calf-raise', targetSets: 3, minReps: 10, maxReps: 15 }
		]
	},
	{
		id: 'arm-day',
		name: 'Arm Day',
		description: 'Biceps and triceps, alternating so each gets a rest.',
		level: 'intermediate',
		timer: { minutes: 1, seconds: 30 },
		exercises: [
			{ exerciseId: 'close-grip-bench-press', targetSets: 3, minReps: 8, maxReps: 10 },
			{ exerciseId: 'barbell-curl', targetSets: 3, minReps: 8, maxReps: 12 },
			{ exerciseId: 'skull-crusher', targetSets: 3, minReps: 10, maxReps: 12 },
			{ exerciseId: 'hammer-curl', targetSets: 3, minReps: 10, maxReps: 12 },
			{ exerciseId: 'triceps-pushdown', targetSets: 2, minReps: 12, maxReps: 15 },
			{ exerciseId: 'cable-curl', targetSets: 2, minReps: 12, maxReps: 15 }
		]
	},
	{
		id: 'glutes-and-hamstrings',
		name: 'Glutes & Hamstrings',
		description: 'Posterior-chain focus: thrusts, hinges and curls.',
		level: 'intermediate',
		timer: { minutes: 2, seconds: 0 },
		exercises: [
			{ exerciseId: 'hip-thrust', targetSets: 4, minReps: 8, maxReps: 12 },
			{ exerciseId: 'romanian-deadlift', targetSets: 3, minReps: 8, maxReps: 10 },
			{ exerciseId: 'bulgarian-split-squat', targetSets: 3, minReps: 10, maxReps: 12 },
			{ exerciseId: 'seated-leg-curl', targetSets: 3, minReps: 10, maxReps: 15 },
			{ exerciseId: 'kettlebell-swing', targetSets: 3, minReps: 15, maxReps: 20 }
		]
	},
	{
		id: 'core-finisher',
		name: 'Core Finisher',
		description: 'A short core block to tack onto the end of any session.',
		level: 'beginner',
		timer: { minutes: 1, seconds: 0 },
		exercises: [
			{ exerciseId: 'hanging-leg-raise', targetSets: 3, minReps: 8, maxReps: 15 },
			{ exerciseId: 'cable-crunch', targetSets: 3, minReps: 10, maxReps: 15 },
			{ exerciseId: 'pallof-press', targetSets: 2, minReps: 10, maxReps: 12 }
		]
	}
];
