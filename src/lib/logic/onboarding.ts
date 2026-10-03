export type MinimalUserData = {
	username?: string;
	photoURL?: string | null;
};

/**
 * The single source of truth for "where does this user have to be right now".
 *
 * Used by the server load (to redirect before render) and by the root layout
 * (to catch the client-side case where Firestore's offline cache resolves a
 * write before the server has it). Both callers use this function rather than
 * re-deriving the rules, so the two can't drift.
 *
 * Claiming a username is the only hard gate. Preferences are seeded with
 * defaults at that point, so a new account lands in the app and can start
 * logging immediately instead of answering a settings questionnaire first.
 */
export function getRequiredOnboardingRoute(
	pathname: string,
	userData: MinimalUserData | null | undefined
): string | null {
	if (!userData?.username) {
		return pathname.startsWith('/login') ? null : '/login/username';
	}

	// Onboarded — nothing left to do but get out of the login flow.
	if (pathname.startsWith('/login')) return '/';
	return null;
}

/** Where to land immediately after a successful sign-in. */
export function getPostLoginDestination(userData: MinimalUserData | null | undefined): string {
	return getRequiredOnboardingRoute('/', userData) ?? '/';
}
