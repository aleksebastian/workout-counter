import { adminAuth } from '$lib/server/admin';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canStartSession, SESSION_MAX_AGE_MS } from '$lib/server/session';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	let idToken: unknown;
	try {
		({ idToken } = await request.json());
	} catch {
		throw error(400, 'Invalid request body');
	}
	if (typeof idToken !== 'string' || !idToken) {
		throw error(400, 'Missing idToken');
	}

	let decodedIdToken;
	try {
		// checkRevoked: a signed-out-everywhere or disabled account can't come back
		// in on a token minted just before.
		decodedIdToken = await adminAuth.verifyIdToken(idToken, true);
	} catch (e) {
		// Only a verdict on the token itself (revoked, disabled, expired,
		// malformed) is a 401: the client signs the device out on one. A failure
		// to reach Firebase is worth a retry instead.
		if ((e as { code?: string }).code?.startsWith('auth/')) {
			return json({ reason: 'invalid-token' }, { status: 401 });
		}
		throw error(503, "Couldn't verify the sign-in");
	}

	if (!canStartSession(decodedIdToken, Date.now() / 1000)) {
		return json({ reason: 'stale-token' }, { status: 401 });
	}

	const expiresIn = SESSION_MAX_AGE_MS;
	const cookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
	// Secure everywhere but plain-http localhost (dev, the end-to-end build),
	// where WebKit drops a Secure cookie and sign-in then bounces. Keyed on
	// the host, not the protocol, so a proxy reporting http can't weaken it.
	const secure = !(url.hostname === 'localhost' && url.protocol === 'http:');
	const options = { maxAge: expiresIn / 1000, httpOnly: true, secure, path: '/' };

	cookies.set('__session', cookie, options);

	return json({ status: 'signedIn' });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	cookies.delete('__session', { path: '/' });
	return json({ status: 'signedOut' });
};
