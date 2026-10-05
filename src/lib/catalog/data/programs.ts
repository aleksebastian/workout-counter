import type { CatalogProgram } from '../types';

// Days are 0=Sun … 6=Sat, matching `ProgramDay`.
export const programs: CatalogProgram[] = [
	{
		id: 'full-body-beginner',
		name: 'Full Body Beginner',
		description:
			'Three full-body sessions a week, alternating A and B. The simplest way to build a base.',
		level: 'beginner',
		schedule: [
			{ day: 1, items: [{ type: 'routine', routineId: 'full-body-a' }] },
			{ day: 3, items: [{ type: 'routine', routineId: 'full-body-b' }] },
			{ day: 5, items: [{ type: 'routine', routineId: 'full-body-a' }] }
		]
	},
	{
		id: 'bodyweight-at-home',
		name: 'Bodyweight at Home',
		description: 'Three short equipment-free sessions a week, with a push-up finisher.',
		level: 'beginner',
		schedule: [
			{ day: 1, items: [{ type: 'routine', routineId: 'bodyweight-basics' }] },
			{
				day: 3,
				items: [
					{ type: 'routine', routineId: 'bodyweight-basics' },
					{ type: 'exercise', exerciseId: 'push-up', targetSets: 2 }
				]
			},
			{ day: 5, items: [{ type: 'routine', routineId: 'bodyweight-basics' }] }
		]
	},
	{
		id: 'push-pull-legs',
		name: 'Push Pull Legs',
		description: 'The classic split, once through each week. Every muscle group gets its own day.',
		level: 'intermediate',
		schedule: [
			{ day: 1, items: [{ type: 'routine', routineId: 'push-day' }] },
			{ day: 3, items: [{ type: 'routine', routineId: 'pull-day' }] },
			{ day: 5, items: [{ type: 'routine', routineId: 'leg-day' }] }
		]
	},
	{
		id: 'push-pull-legs-6-day',
		name: 'Push Pull Legs (6-Day)',
		description: 'The same split run twice a week, for lifters who can recover from high volume.',
		level: 'advanced',
		schedule: [
			{ day: 1, items: [{ type: 'routine', routineId: 'push-day' }] },
			{ day: 2, items: [{ type: 'routine', routineId: 'pull-day' }] },
			{ day: 3, items: [{ type: 'routine', routineId: 'leg-day' }] },
			{ day: 4, items: [{ type: 'routine', routineId: 'push-day' }] },
			{ day: 5, items: [{ type: 'routine', routineId: 'pull-day' }] },
			{ day: 6, items: [{ type: 'routine', routineId: 'leg-day' }] }
		]
	},
	{
		id: 'upper-lower',
		name: 'Upper / Lower',
		description:
			'Four days a week, each half of the body trained twice. Core work after lower days.',
		level: 'intermediate',
		schedule: [
			{ day: 1, items: [{ type: 'routine', routineId: 'upper-body' }] },
			{
				day: 2,
				items: [
					{ type: 'routine', routineId: 'lower-body' },
					{ type: 'exercise', exerciseId: 'hanging-leg-raise', targetSets: 3 }
				]
			},
			{ day: 4, items: [{ type: 'routine', routineId: 'upper-body' }] },
			{
				day: 5,
				items: [
					{ type: 'routine', routineId: 'lower-body' },
					{ type: 'exercise', exerciseId: 'hanging-leg-raise', targetSets: 3 }
				]
			}
		]
	}
];
