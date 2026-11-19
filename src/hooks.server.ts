import { adminAuth } from '$lib/server/admin';
import type { Handle } from '@sveltejs/kit';

// Security headers (framing, sniffing, referrer, permissions) are set for
// every path in vercel.json, so static files from the CDN get them too; the
// Content-Security-Policy is `kit.csp` in svelte.config.js.

async function userIdFrom(sessionCookie: string | undefined): Promise<string | null> {
	if (!sessionCookie) return null;
	try {
		// Not `checkRevoked`: that's an Auth API round trip on every request. A
		// deleted account's cookie still verifies here, but the routes it could
		// reach need its user document, which deletion removed, and its devices
		// stop refreshing their Firebase sign-in within the hour, which signs
		// them out and clears the cookie.
		return (await adminAuth.verifySessionCookie(sessionCookie)).uid;
	} catch {
		return null;
	}
}

export const handle = (async ({ event, resolve }) => {
	event.locals.userID = await userIdFrom(event.cookies.get('__session'));
	return resolve(event);
}) satisfies Handle;
