/**
 * The in-app changelog behind "What's new" — written for the people using
 * SetCount, not for us. Say what changed for them, in their words: no PR
 * numbers, file names or library upgrades. Bug fixes and behind-the-scenes
 * work go under `fixed`, summarised in plain language.
 *
 * Bumping the version in package.json needs an entry here first; the unit test
 * fails until the newest entry matches it.
 */

export interface ChangelogEntry {
	/** Matches package.json, e.g. '0.12.0'. */
	version: string;
	/** Release day, 'YYYY-MM-DD'. */
	date: string;
	new?: string[];
	improved?: string[];
	fixed?: string[];
}

/** Newest first. */
export const CHANGELOG: ChangelogEntry[] = [
	{
		version: '0.15.1',
		date: '2026-10-20',
		fixed: [
			'Updating the app no longer leaves you stuck on the sign-in screen with “Couldn’t start your session”',
			'You stay signed in as long as you keep using the app, instead of being asked again every few days'
		]
	},
	{
		version: '0.15.0',
		date: '2026-10-20',
		improved: [
			'Signing out now clears your workout data from this device',
			'If something you logged hasn’t synced yet, signing out asks before it’s lost'
		],
		fixed: ['Editing a set during a workout no longer drops it from that workout']
	},
	{
		version: '0.14.0',
		date: '2026-10-19',
		new: ['Use SetCount on more than one device — each one gets its own rest alerts'],
		improved: [
			'Rest-end alerts go to the device you started the rest on, not every device you use',
			'Preferences shows alerts as off when this device can’t receive them, so you can turn them back on'
		]
	},
	{
		version: '0.13.2',
		date: '2026-10-19',
		fixed: [
			'Rest-end notifications no longer arrive after you skip a rest, close the app mid-rest, or sign out',
			'Deleting a set you just edited works again',
			'General reliability and security improvements'
		]
	},
	{
		version: '0.13.1',
		date: '2026-10-12',
		fixed: ['Pop-up messages no longer cover the tab bar']
	},
	{
		version: '0.13.0',
		date: '2026-10-12',
		new: [
			"What's new: see what changed in each update from your account screen",
			'After an update, a quick note lets you know there’s something new to see'
		]
	},
	{
		version: '0.12.0',
		date: '2026-10-12',
		new: ['Report a bug or send a suggestion straight from your account screen']
	},
	{
		version: '0.11.0',
		date: '2026-10-11',
		improved: [
			'Rest timer preferences now explain which rest ranges suit strength, muscle and endurance goals'
		]
	},
	{
		version: '0.10.0',
		date: '2026-10-11',
		new: [
			'A redesigned workout screen built around logging your next set',
			'Add a note to any set with one tap',
			'Resume a workout you ended early today',
			'Discard a workout you started by mistake',
			'See an exercise’s past sets without leaving your workout'
		],
		improved: [
			'Reps and weight sit side by side, with their own +/− buttons',
			'Tap reps or weight to type a new value straight away',
			'The workout opens full screen and can be minimised while you browse the app',
			'Switch between what’s up next and your rest countdown'
		],
		fixed: [
			'Your light or dark theme shows from the very first moment the app opens',
			'Today no longer looks cut off in the program day picker',
			'An exercise stays done after you log an extra set'
		]
	},
	{
		version: '0.9.2',
		date: '2026-10-09',
		fixed: [
			'Signing in no longer gets stuck after you pick your Google account',
			'An out-of-date app updates itself before finishing sign-in'
		]
	},
	{
		version: '0.9.1',
		date: '2026-10-08',
		improved: ['The app downloads less when it updates, so updates are quicker'],
		fixed: ['Behind-the-scenes fixes to keep things running smoothly']
	},
	{
		version: '0.9.0',
		date: '2026-10-08',
		new: ['Tapping your avatar opens a full-screen account screen']
	},
	{
		version: '0.8.0',
		date: '2026-10-08',
		new: [
			'Delete your account and all your data from Preferences',
			'Your username now shows in the account menu',
			'The getting-started checklist ends with a “you’re set up” card'
		],
		improved: [
			'Clearer controls while a workout is running',
			'Your first set starts at the routine’s rep target',
			'You’re warned before adding a program that would duplicate one of your routines',
			'The Library reopens on the tab you used last',
			'A tidier Preferences screen'
		],
		fixed: [
			'Sign-in no longer times out while you’re still choosing your Google account',
			'Sign-in works again after closing Google’s sheet without signing in',
			'Train can log a set for an exercise you haven’t done yet',
			'Banners no longer cover the end of a page',
			'Holding a drag handle reorders instead of selecting text',
			'Username rules match their message, and checking never hangs',
			'“1 set” instead of “1 sets”',
			'A workout is only called complete when it is'
		]
	},
	{
		version: '0.7.0',
		date: '2026-10-07',
		new: [
			'Your workout in progress is saved, so closing the app doesn’t lose it',
			'A bar shows your workout in progress from anywhere in the app',
			'Finished workouts are kept as history'
		]
	},
	{
		version: '0.6.0',
		date: '2026-10-04',
		new: [
			'Discover: browse ready-made exercises, routines and programs and add them to your Library'
		],
		improved: [
			'Adding exercises to a routine is now a simple pick-and-confirm list',
			'The getting-started checklist starts with setting up your rest timer'
		],
		fixed: [
			'Rest timers set on a routine only apply to that routine',
			'Programs added while offline activate straight away',
			'Every option in action sheets is visible, and sheets scroll back up',
			'iOS no longer suggests contacts when naming a new exercise'
		]
	},
	{
		version: '0.5.4',
		date: '2026-10-03',
		fixed: ['Icons display correctly again']
	},
	{
		version: '0.5.3',
		date: '2026-10-03',
		improved: ['Routine targets are easier to type, with a clear rep range'],
		fixed: ['Swipeable rows no longer hide under their actions']
	},
	{
		version: '0.5.2',
		date: '2026-10-03',
		improved: ['Shows progress while an update is being installed'],
		fixed: ['Only asks you to update when there’s actually something new']
	},
	{
		version: '0.5.1',
		date: '2026-10-03',
		improved: [
			'Looks and feels more at home on iPhone: native-height tab bar and a cleaner header'
		],
		fixed: [
			'Sheets stay lined up with the iPhone keyboard',
			'You can always choose which Google account to sign in with'
		]
	},
	{
		version: '0.5.0',
		date: '2026-10-03',
		new: ['Turn on rest alerts from the getting-started checklist'],
		fixed: [
			'Rest alerts work when you allow them from your phone’s settings',
			'The app is reachable again after an outage'
		]
	},
	{
		version: '0.4.0',
		date: '2026-10-03',
		new: [
			'A new home: Home, Train and Library tabs',
			'Exercises, routines and programs now live together in the Library',
			'A getting-started checklist for new accounts'
		],
		improved: ['You’re told when something fails to save instead of it silently going missing'],
		fixed: [
			'Sign-in, sign-out and first-time setup are much more reliable',
			'Your data is better protected'
		]
	},
	{
		version: '0.3.0',
		date: '2026-05-01',
		new: [
			'Routines and programs to plan your training week',
			'Rest alerts that notify you when rest ends, even outside the app',
			'Add notes to sets, exercises and programs',
			'Swipe a set to duplicate it',
			'Works offline — changes sync when you reconnect'
		],
		improved: [
			'Sort options right in the header',
			'More rest timer presets',
			'Smoother sheets, transitions and loading screens'
		]
	},
	{
		version: '0.2.0',
		date: '2026-03-21',
		new: ['Choose a light or dark theme'],
		improved: ['A refreshed look throughout', 'Simpler Google sign-in']
	},
	{
		version: '0.1.3',
		date: '2025-06-18',
		new: ['Install SetCount on your home screen like an app']
	},
	{
		version: '0.1.2',
		date: '2025-02-04',
		fixed: ['The menu no longer appears after your session has expired']
	},
	{
		version: '0.1.1',
		date: '2025-02-03',
		improved: ['New sets start with the reps from your last set'],
		fixed: ['Dialogs behave better on phones', 'No more layout jump while the app loads']
	},
	{
		version: '0.1.0',
		date: '2025-01-14',
		new: [
			'Log sets for your exercises, newest first',
			'A rest timer that keeps counting even if you leave the app',
			'Sign in with Google to keep your workouts in sync',
			'Pick a username and set your preferences'
		]
	}
];

/** Compares 'x.y.z' versions: negative when a is older than b. */
export function compareVersions(a: string, b: string): number {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (diff) return diff;
	}
	return 0;
}

/** Entries released after `lastSeen`, newest first. All of them when nothing was seen. */
export function unseenEntries(lastSeen: string | null): ChangelogEntry[] {
	if (!lastSeen) return CHANGELOG;
	return CHANGELOG.filter((e) => compareVersions(e.version, lastSeen) > 0);
}
