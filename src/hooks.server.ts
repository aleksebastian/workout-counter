import { adminAuth } from '$lib/server/admin';
import type { Handle } from '@sveltejs/kit';

export const handle = (async ({ event, resolve }) => {
	const sessionCookie = event.cookies.get('__session');

	if (!sessionCookie) {
		event.locals.userID = null;
		return resolve(event);
	}

	try {
		const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie);
		event.locals.userID = decodedClaims.uid;
	} catch {
		event.locals.userID = null;
	}

	return resolve(event);
}) satisfies Handle;
