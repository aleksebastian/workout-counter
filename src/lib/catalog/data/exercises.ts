import type { CatalogExercise } from '../types';

/**
 * Only rep-counted movements belong here — the app logs reps (and optionally
 * weight), so timed holds like planks or carries have nowhere to record.
 */
export const exercises: CatalogExercise[] = [
	// ── Chest ──────────────────────────────────────────────────────────────────
	{
		id: 'barbell-bench-press',
		name: 'Barbell Bench Press',
		aliases: ['Bench Press', 'Bench', 'Flat Bench Press'],
		muscles: ['chest', 'triceps', 'shoulders'],
		equipment: 'barbell',
		instructions:
			'Lie on a flat bench with eyes under the bar. Lower it to mid-chest with elbows slightly tucked, then press back up over your shoulders.'
	},
	{
		id: 'incline-barbell-bench-press',
		name: 'Incline Barbell Bench Press',
		aliases: ['Incline Bench Press', 'Incline Bench'],
		muscles: ['chest', 'shoulders', 'triceps'],
		equipment: 'barbell',
		instructions:
			'Set the bench to about 30°. Lower the bar to your upper chest and press it back up in a slight arc over your face.'
	},
	{
		id: 'dumbbell-bench-press',
		name: 'Dumbbell Bench Press',
		aliases: ['DB Bench Press', 'DB Bench'],
		muscles: ['chest', 'triceps', 'shoulders'],
		equipment: 'dumbbell',
		instructions:
			'Lie flat holding a dumbbell over each shoulder. Lower them to the sides of your chest, then press up until your arms are straight.'
	},
	{
		id: 'incline-dumbbell-press',
		name: 'Incline Dumbbell Press',
		aliases: ['Incline DB Press', 'Incline Dumbbell Bench Press'],
		muscles: ['chest', 'shoulders', 'triceps'],
		equipment: 'dumbbell',
		instructions:
			'On a bench set to about 30°, lower the dumbbells to your upper chest, then press them up and slightly together.'
	},
	{
		id: 'dumbbell-fly',
		name: 'Dumbbell Fly',
		aliases: ['Dumbbell Flye', 'DB Fly'],
		muscles: ['chest'],
		equipment: 'dumbbell',
		instructions:
			'Lie flat with dumbbells over your chest and a soft bend in your elbows. Open your arms wide until you feel a stretch, then hug them back together.'
	},
	{
		id: 'cable-fly',
		name: 'Cable Fly',
		aliases: ['Cable Crossover', 'Cable Flye'],
		muscles: ['chest'],
		equipment: 'cable',
		instructions:
			'Stand between two high pulleys with a staggered stance. Keeping elbows slightly bent, bring the handles down and together in front of your chest.'
	},
	{
		id: 'pec-deck',
		name: 'Pec Deck',
		aliases: ['Machine Fly', 'Pec Fly'],
		muscles: ['chest'],
		equipment: 'machine',
		instructions:
			'Sit tall with the handles at chest height. Squeeze the arms together in front of you, pause, then let them open under control.'
	},
	{
		id: 'machine-chest-press',
		name: 'Machine Chest Press',
		aliases: ['Chest Press'],
		muscles: ['chest', 'triceps', 'shoulders'],
		equipment: 'machine',
		instructions:
			'Adjust the seat so the handles line up with mid-chest. Press forward until your arms are straight, then return slowly.'
	},
	{
		id: 'push-up',
		name: 'Push-Up',
		aliases: ['Pushup', 'Push-Ups', 'Pushups'],
		muscles: ['chest', 'triceps', 'shoulders'],
		equipment: 'bodyweight',
		instructions:
			'Hands slightly wider than shoulders, body in a straight line. Lower your chest to just above the floor, then push back up.'
	},
	{
		id: 'incline-push-up',
		name: 'Incline Push-Up',
		aliases: ['Incline Pushup', 'Incline Push-Ups'],
		muscles: ['chest', 'triceps', 'shoulders'],
		equipment: 'bodyweight',
		instructions:
			'Place your hands on a bench or counter and do a push-up from there. The higher the surface, the easier it gets.'
	},
	{
		id: 'dip',
		name: 'Dip',
		aliases: ['Dips', 'Parallel Bar Dip', 'Chest Dip'],
		muscles: ['chest', 'triceps', 'shoulders'],
		equipment: 'bodyweight',
		instructions:
			'Support yourself on parallel bars. Lean slightly forward and lower until your upper arms are about parallel to the floor, then press back up.'
	},

	// ── Back ───────────────────────────────────────────────────────────────────
	{
		id: 'deadlift',
		name: 'Deadlift',
		aliases: ['Conventional Deadlift', 'Barbell Deadlift'],
		muscles: ['back', 'hamstrings', 'glutes'],
		equipment: 'barbell',
		instructions:
			'Stand with the bar over mid-foot. Grip just outside your legs, brace, and stand up by driving through the floor with a flat back. Lower it the same way.'
	},
	{
		id: 'trap-bar-deadlift',
		name: 'Trap Bar Deadlift',
		aliases: ['Hex Bar Deadlift'],
		muscles: ['quads', 'glutes', 'back'],
		equipment: 'barbell',
		instructions:
			'Stand inside the bar and grip the handles. Brace, push the floor away and stand tall, then lower with control.'
	},
	{
		id: 'romanian-deadlift',
		name: 'Romanian Deadlift',
		aliases: ['RDL', 'Barbell RDL'],
		muscles: ['hamstrings', 'glutes', 'back'],
		equipment: 'barbell',
		instructions:
			'Hold the bar at your hips. With soft knees, push your hips back and slide the bar down your thighs until you feel a hamstring stretch, then drive your hips forward.'
	},
	{
		id: 'dumbbell-romanian-deadlift',
		name: 'Dumbbell Romanian Deadlift',
		aliases: ['DB RDL', 'Dumbbell RDL'],
		muscles: ['hamstrings', 'glutes', 'back'],
		equipment: 'dumbbell',
		instructions:
			'Hold dumbbells in front of your thighs. Hinge at the hips with soft knees, lowering them along your legs, then stand back up by squeezing your glutes.'
	},
	{
		id: 'pull-up',
		name: 'Pull-Up',
		aliases: ['Pullup', 'Pull-Ups', 'Pullups'],
		muscles: ['back', 'biceps'],
		equipment: 'bodyweight',
		instructions:
			'Hang from a bar with an overhand grip. Pull your chest toward the bar by driving your elbows down, then lower all the way.'
	},
	{
		id: 'chin-up',
		name: 'Chin-Up',
		aliases: ['Chinup', 'Chin-Ups', 'Chinups'],
		muscles: ['back', 'biceps'],
		equipment: 'bodyweight',
		instructions:
			'Hang from a bar with palms facing you, shoulder-width apart. Pull until your chin clears the bar, then lower all the way.'
	},
	{
		id: 'assisted-pull-up',
		name: 'Assisted Pull-Up',
		aliases: ['Assisted Pullup', 'Machine Assisted Pull-Up'],
		muscles: ['back', 'biceps'],
		equipment: 'machine',
		instructions:
			'Kneel or stand on the assist platform and do a pull-up. More counterweight makes it easier.'
	},
	{
		id: 'lat-pulldown',
		name: 'Lat Pulldown',
		aliases: ['Pulldown', 'Lat Pull Down', 'Cable Pulldown'],
		muscles: ['back', 'biceps'],
		equipment: 'cable',
		instructions:
			'Grip the bar slightly wider than shoulders. Lean back a little and pull it to your upper chest, then let it rise under control.'
	},
	{
		id: 'barbell-row',
		name: 'Barbell Row',
		aliases: ['Bent-Over Row', 'Barbell Bent-Over Row', 'Row'],
		muscles: ['back', 'biceps'],
		equipment: 'barbell',
		instructions:
			'Hinge forward with a flat back, bar hanging at arm’s length. Row it to your lower ribs, then lower it under control.'
	},
	{
		id: 'dumbbell-row',
		name: 'Dumbbell Row',
		aliases: ['One-Arm Dumbbell Row', 'Single-Arm Dumbbell Row', 'DB Row'],
		muscles: ['back', 'biceps'],
		equipment: 'dumbbell',
		instructions:
			'Brace one hand and knee on a bench. Row the dumbbell toward your hip, keeping your torso still, then lower it. Count reps per side.'
	},
	{
		id: 'seated-cable-row',
		name: 'Seated Cable Row',
		aliases: ['Cable Row', 'Seated Row'],
		muscles: ['back', 'biceps'],
		equipment: 'cable',
		instructions:
			'Sit tall with feet on the platform. Pull the handle to your stomach, squeezing your shoulder blades together, then reach forward again.'
	},
	{
		id: 'inverted-row',
		name: 'Inverted Row',
		aliases: ['Bodyweight Row', 'Australian Pull-Up'],
		muscles: ['back', 'biceps'],
		equipment: 'bodyweight',
		instructions:
			'Hang under a bar or sturdy table with your body straight. Pull your chest up to it, then lower. Walk your feet back to make it harder.'
	},
	{
		id: 'face-pull',
		name: 'Face Pull',
		aliases: ['Face Pulls', 'Cable Face Pull'],
		muscles: ['shoulders', 'back'],
		equipment: 'cable',
		instructions:
			'Set a rope at upper-chest height. Pull it toward your face, spreading the ends apart and finishing with your hands beside your ears.'
	},
	{
		id: 'barbell-shrug',
		name: 'Barbell Shrug',
		aliases: ['Shrug', 'Shrugs'],
		muscles: ['back'],
		equipment: 'barbell',
		instructions:
			'Hold the bar at arm’s length. Lift your shoulders straight up toward your ears, pause, then lower.'
	},
	{
		id: 'back-extension',
		name: 'Back Extension',
		aliases: ['Hyperextension', 'Back Extensions'],
		muscles: ['back', 'glutes', 'hamstrings'],
		equipment: 'bodyweight',
		instructions:
			'On a back-extension bench, lower your torso by hinging at the hips, then raise it until your body is in a straight line.'
	},

	// ── Shoulders ──────────────────────────────────────────────────────────────
	{
		id: 'overhead-press',
		name: 'Overhead Press',
		aliases: ['OHP', 'Military Press', 'Barbell Overhead Press', 'Standing Press'],
		muscles: ['shoulders', 'triceps'],
		equipment: 'barbell',
		instructions:
			'Stand with the bar on your front shoulders. Brace and press it straight overhead, moving your head back out of the way, then lower to your chest.'
	},
	{
		id: 'dumbbell-shoulder-press',
		name: 'Dumbbell Shoulder Press',
		aliases: ['DB Shoulder Press', 'Seated Dumbbell Press', 'Shoulder Press'],
		muscles: ['shoulders', 'triceps'],
		equipment: 'dumbbell',
		instructions:
			'Seated or standing, start with dumbbells at shoulder height. Press them overhead until your arms are straight, then lower.'
	},
	{
		id: 'lateral-raise',
		name: 'Lateral Raise',
		aliases: ['Dumbbell Lateral Raise', 'Side Lateral Raise', 'Side Raise', 'Lateral Raises'],
		muscles: ['shoulders'],
		equipment: 'dumbbell',
		instructions:
			'Hold light dumbbells at your sides. Raise them out to shoulder height with a slight bend in your elbows, then lower slowly.'
	},
	{
		id: 'rear-delt-fly',
		name: 'Rear Delt Fly',
		aliases: ['Reverse Fly', 'Rear Delt Flye', 'Reverse Dumbbell Fly'],
		muscles: ['shoulders', 'back'],
		equipment: 'dumbbell',
		instructions:
			'Hinge forward with light dumbbells hanging below you. Raise them out to the sides, leading with your elbows, then lower.'
	},

	// ── Arms ───────────────────────────────────────────────────────────────────
	{
		id: 'barbell-curl',
		name: 'Barbell Curl',
		aliases: ['BB Curl', 'Standing Barbell Curl', 'EZ-Bar Curl'],
		muscles: ['biceps', 'forearms'],
		equipment: 'barbell',
		instructions:
			'Hold the bar with palms up, elbows at your sides. Curl it to your shoulders without swinging, then lower all the way.'
	},
	{
		id: 'dumbbell-curl',
		name: 'Dumbbell Curl',
		aliases: ['Bicep Curl', 'Biceps Curl', 'DB Curl', 'Dumbbell Bicep Curl'],
		muscles: ['biceps', 'forearms'],
		equipment: 'dumbbell',
		instructions:
			'Hold dumbbells at your sides, palms forward. Curl them up while keeping your elbows still, then lower all the way.'
	},
	{
		id: 'hammer-curl',
		name: 'Hammer Curl',
		aliases: ['Hammer Curls', 'Dumbbell Hammer Curl'],
		muscles: ['biceps', 'forearms'],
		equipment: 'dumbbell',
		instructions:
			'Hold dumbbells with palms facing each other. Curl them up without rotating your wrists, then lower.'
	},
	{
		id: 'cable-curl',
		name: 'Cable Curl',
		aliases: ['Cable Bicep Curl'],
		muscles: ['biceps', 'forearms'],
		equipment: 'cable',
		instructions:
			'Face a low pulley holding a straight bar. Curl it to your shoulders with elbows pinned, then lower against the cable.'
	},
	{
		id: 'triceps-pushdown',
		name: 'Triceps Pushdown',
		aliases: ['Tricep Pushdown', 'Cable Pushdown', 'Rope Pushdown', 'Tricep Pressdown'],
		muscles: ['triceps'],
		equipment: 'cable',
		instructions:
			'Face a high pulley with a rope or bar. Keeping elbows at your sides, push down until your arms are straight, then let it rise.'
	},
	{
		id: 'overhead-triceps-extension',
		name: 'Overhead Triceps Extension',
		aliases: ['Overhead Tricep Extension', 'Dumbbell Overhead Extension'],
		muscles: ['triceps'],
		equipment: 'dumbbell',
		instructions:
			'Hold one dumbbell overhead with both hands. Lower it behind your head by bending your elbows, then extend back up.'
	},
	{
		id: 'skull-crusher',
		name: 'Skull Crusher',
		aliases: ['Skullcrusher', 'Skull Crushers', 'Lying Triceps Extension'],
		muscles: ['triceps'],
		equipment: 'barbell',
		instructions:
			'Lie on a bench holding a bar over your chest. Bend only at the elbows to lower it toward your forehead, then extend back up.'
	},
	{
		id: 'close-grip-bench-press',
		name: 'Close-Grip Bench Press',
		aliases: ['Close Grip Bench', 'CGBP'],
		muscles: ['triceps', 'chest'],
		equipment: 'barbell',
		instructions:
			'Bench press with hands about shoulder-width apart and elbows tucked close to your body.'
	},

	// ── Legs ───────────────────────────────────────────────────────────────────
	{
		id: 'back-squat',
		name: 'Back Squat',
		aliases: ['Squat', 'Barbell Squat', 'Barbell Back Squat'],
		muscles: ['quads', 'glutes'],
		equipment: 'barbell',
		instructions:
			'With the bar across your upper back, brace and sit down between your heels until your thighs are at least parallel, then stand back up.'
	},
	{
		id: 'front-squat',
		name: 'Front Squat',
		aliases: ['Barbell Front Squat'],
		muscles: ['quads', 'glutes', 'core'],
		equipment: 'barbell',
		instructions:
			'Rest the bar on your front shoulders with elbows high. Squat down keeping your torso upright, then stand back up.'
	},
	{
		id: 'goblet-squat',
		name: 'Goblet Squat',
		aliases: ['Dumbbell Goblet Squat', 'Kettlebell Goblet Squat'],
		muscles: ['quads', 'glutes'],
		equipment: 'dumbbell',
		instructions:
			'Hold a dumbbell vertically against your chest. Squat down between your knees with your chest up, then stand.'
	},
	{
		id: 'bodyweight-squat',
		name: 'Bodyweight Squat',
		aliases: ['Air Squat', 'Air Squats'],
		muscles: ['quads', 'glutes'],
		equipment: 'bodyweight',
		instructions:
			'Feet shoulder-width apart, arms out for balance. Sit your hips down and back as low as you comfortably can, then stand.'
	},
	{
		id: 'leg-press',
		name: 'Leg Press',
		aliases: ['Machine Leg Press'],
		muscles: ['quads', 'glutes'],
		equipment: 'machine',
		instructions:
			'Feet shoulder-width on the platform. Lower it until your knees reach about 90°, keeping your lower back on the pad, then press away.'
	},
	{
		id: 'bulgarian-split-squat',
		name: 'Bulgarian Split Squat',
		aliases: ['Split Squat', 'Rear-Foot-Elevated Split Squat', 'BSS'],
		muscles: ['quads', 'glutes'],
		equipment: 'dumbbell',
		instructions:
			'Rest your back foot on a bench. Lower straight down until your front thigh is about parallel, then drive back up. Count reps per side.'
	},
	{
		id: 'walking-lunge',
		name: 'Walking Lunge',
		aliases: ['Lunge', 'Lunges', 'Walking Lunges', 'Dumbbell Lunge'],
		muscles: ['quads', 'glutes'],
		equipment: 'dumbbell',
		instructions:
			'Step forward and lower until both knees are bent about 90°, then step through into the next lunge. Count each leg as a rep.'
	},
	{
		id: 'reverse-lunge',
		name: 'Reverse Lunge',
		aliases: ['Reverse Lunges', 'Dumbbell Reverse Lunge'],
		muscles: ['quads', 'glutes'],
		equipment: 'bodyweight',
		instructions:
			'Step one foot back and lower until both knees are bent about 90°, then push through the front foot to return. Alternate legs.'
	},
	{
		id: 'step-up',
		name: 'Step-Up',
		aliases: ['Step-Ups', 'Dumbbell Step-Up'],
		muscles: ['quads', 'glutes'],
		equipment: 'dumbbell',
		instructions:
			'Place one foot on a box or bench. Drive through that heel to stand up on it, then step back down with control. Count reps per side.'
	},
	{
		id: 'leg-extension',
		name: 'Leg Extension',
		aliases: ['Leg Extensions', 'Quad Extension'],
		muscles: ['quads'],
		equipment: 'machine',
		instructions:
			'Sit with the pad on your lower shins. Straighten your legs, squeeze at the top, then lower slowly.'
	},
	{
		id: 'lying-leg-curl',
		name: 'Lying Leg Curl',
		aliases: ['Leg Curl', 'Hamstring Curl'],
		muscles: ['hamstrings'],
		equipment: 'machine',
		instructions:
			'Lie face down with the pad just above your heels. Curl your heels toward your glutes, then lower slowly.'
	},
	{
		id: 'seated-leg-curl',
		name: 'Seated Leg Curl',
		muscles: ['hamstrings'],
		equipment: 'machine',
		instructions:
			'Sit with the pad behind your lower calves and the thigh pad snug. Curl your heels under you, then let them return slowly.'
	},
	{
		id: 'hip-thrust',
		name: 'Hip Thrust',
		aliases: ['Barbell Hip Thrust', 'Hip Thrusts'],
		muscles: ['glutes', 'hamstrings'],
		equipment: 'barbell',
		instructions:
			'Rest your upper back on a bench with a padded bar over your hips. Drive your hips up until your body is flat from shoulders to knees, then lower.'
	},
	{
		id: 'glute-bridge',
		name: 'Glute Bridge',
		aliases: ['Glute Bridges', 'Bridge'],
		muscles: ['glutes', 'hamstrings'],
		equipment: 'bodyweight',
		instructions:
			'Lie on your back, knees bent and feet flat. Squeeze your glutes to lift your hips until your body is straight from shoulders to knees, then lower.'
	},
	{
		id: 'kettlebell-swing',
		name: 'Kettlebell Swing',
		aliases: ['KB Swing', 'Russian Swing'],
		muscles: ['glutes', 'hamstrings', 'back'],
		equipment: 'kettlebell',
		instructions:
			'Hike the bell back between your legs, then snap your hips forward to float it to chest height. Let it fall back into the next rep.'
	},
	{
		id: 'standing-calf-raise',
		name: 'Standing Calf Raise',
		aliases: ['Calf Raise', 'Calf Raises'],
		muscles: ['calves'],
		equipment: 'machine',
		instructions:
			'Stand with the balls of your feet on a step. Rise as high as you can, pause, then lower until you feel a stretch.'
	},
	{
		id: 'seated-calf-raise',
		name: 'Seated Calf Raise',
		muscles: ['calves'],
		equipment: 'machine',
		instructions:
			'Sit with the pad on your lower thighs and the balls of your feet on the platform. Raise your heels as high as you can, then lower fully.'
	},

	// ── Core ───────────────────────────────────────────────────────────────────
	{
		id: 'hanging-leg-raise',
		name: 'Hanging Leg Raise',
		aliases: ['Hanging Leg Raises', 'Leg Raise'],
		muscles: ['core'],
		equipment: 'bodyweight',
		instructions:
			'Hang from a bar. Without swinging, raise your legs until they are at least parallel to the floor, then lower slowly. Bend your knees to make it easier.'
	},
	{
		id: 'cable-crunch',
		name: 'Cable Crunch',
		aliases: ['Kneeling Cable Crunch'],
		muscles: ['core'],
		equipment: 'cable',
		instructions:
			'Kneel facing a high pulley, holding a rope beside your head. Crunch down by curling your ribs toward your hips, then return.'
	},
	{
		id: 'ab-wheel-rollout',
		name: 'Ab Wheel Rollout',
		aliases: ['Ab Wheel', 'Ab Rollout'],
		muscles: ['core'],
		equipment: 'bodyweight',
		instructions:
			'Kneel holding an ab wheel under your shoulders. Roll forward as far as you can without your lower back sagging, then pull back.'
	},
	{
		id: 'crunch',
		name: 'Crunch',
		aliases: ['Crunches', 'Ab Crunch'],
		muscles: ['core'],
		equipment: 'bodyweight',
		instructions:
			'Lie on your back with knees bent. Curl your shoulders off the floor by tightening your abs, then lower.'
	},
	{
		id: 'dead-bug',
		name: 'Dead Bug',
		aliases: ['Dead Bugs'],
		muscles: ['core'],
		equipment: 'bodyweight',
		instructions:
			'Lie on your back, arms up and knees over hips. Keeping your lower back flat, extend the opposite arm and leg, then switch. Count each side.'
	},
	{
		id: 'russian-twist',
		name: 'Russian Twist',
		aliases: ['Russian Twists'],
		muscles: ['core'],
		equipment: 'bodyweight',
		instructions:
			'Sit leaning back with feet raised or on the floor. Rotate your torso to touch the floor on each side. Count each touch.'
	},
	{
		id: 'pallof-press',
		name: 'Pallof Press',
		muscles: ['core'],
		equipment: 'cable',
		instructions:
			'Stand side-on to a chest-height cable. Press the handle straight out from your chest and resist the pull to rotate, then bring it back. Count reps per side.'
	}
];
