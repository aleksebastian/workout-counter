/** Firebase's own host for the sign-in helper pages (/__/auth/*). */
export const FIREBASE_AUTH_HELPER_ORIGIN = 'https://workout-counter-99d56.firebaseapp.com';

/**
 * Where production is served. Its /__/auth/* is passed through to Firebase
 * (src/routes/__/auth), and `https://<this>/__/auth/handler` is registered as
 * an authorized redirect URI on the Google OAuth client.
 */
export const PRODUCTION_HOST = 'workout-counter-two.vercel.app';

/**
 * The Firebase `authDomain` for a page on `host`. Production uses its own
 * domain so the sign-in helpers are first-party: Safari walls off a cross-site
 * iframe's storage, which breaks the redirect sign-in the installed iOS app
 * relies on. Elsewhere (localhost, preview deploys) there's no registered
 * redirect URI, so those keep Firebase's default domain.
 */
export function authDomainFor(host: string | undefined): string {
	return host === PRODUCTION_HOST ? PRODUCTION_HOST : new URL(FIREBASE_AUTH_HELPER_ORIGIN).host;
}
