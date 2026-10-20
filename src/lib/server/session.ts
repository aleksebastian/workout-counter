/** Firebase's longest session cookie: someone away for a while still walks back in. */
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** How old an ID token may be when it's traded for a session cookie. */
export const FRESH_TOKEN_SECONDS = 5 * 60;

/**
 * Whether an ID token may start a server session. It must have been issued
 * moments ago — proof a live client holds a valid refresh token, the same
 * proof Firestore accepts on every request — but the Google sign-in behind it
 * can be any age. Requiring a recent sign-in instead stranded anyone whose
 * cookie expired while Firebase kept them signed in on the device.
 */
export function canStartSession(token: { iat: number }, nowSeconds: number): boolean {
	const age = nowSeconds - token.iat;
	// A little clock skew between client-issued tokens and this server is fine.
	return age > -60 && age < FRESH_TOKEN_SECONDS;
}
