import { adminAuth } from '$lib/server/admin';
import type { Handle } from '@sveltejs/kit';

/**
 * Sent with every response. The page can't be framed (no clickjacking), the
 * browser mustn't guess content types, other sites get only our origin as a
 * referrer, and powerful features the app doesn't use stay off. The camera
 * isn't needed: photo import uses the system picker.
 */
const SECURITY_HEADERS: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
};

async function userIdFrom(sessionCookie: string | undefined): Promise<string | null> {
	if (!sessionCookie) return null;
	try {
		// Not `checkRevoked`: that's an Auth API round trip on every request. A
		// deleted account's cookie still verifies here, but it has no data left
		// to reach, and its devices stop refreshing their Firebase sign-in
		// within the hour, which signs them out and clears the cookie.
		return (await adminAuth.verifySessionCookie(sessionCookie)).uid;
	} catch {
		return null;
	}
}

export const handle = (async ({ event, resolve }) => {
	event.locals.userID = await userIdFrom(event.cookies.get('__session'));

	const response = await resolve(event);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		// Some responses (a redirect from fetch, say) have immutable headers.
		try {
			response.headers.set(name, value);
		} catch {
			break;
		}
	}
	return response;
}) satisfies Handle;
