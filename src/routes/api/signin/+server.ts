import { adminAuth } from '$lib/server/admin';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

	const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

	let decodedIdToken;
	try {
		decodedIdToken = await adminAuth.verifyIdToken(idToken);
	} catch {
		throw error(401, 'Invalid ID token');
	}

	if (new Date().getTime() / 1000 - decodedIdToken.auth_time < 5 * 60) {
		const cookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
		// Secure everywhere but plain-http localhost (dev, the end-to-end build),
		// where WebKit drops a Secure cookie and sign-in then bounces. Keyed on
		// the host, not the protocol, so a proxy reporting http can't weaken it.
		const secure = !(url.hostname === 'localhost' && url.protocol === 'http:');
		const options = { maxAge: expiresIn, httpOnly: true, secure, path: '/' };

		cookies.set('__session', cookie, options);

		return json({ status: 'signedIn' });
	} else {
		throw error(401, 'Recent sign in required!');
	}
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	cookies.delete('__session', { path: '/' });
	return json({ status: 'signedOut' });
};
