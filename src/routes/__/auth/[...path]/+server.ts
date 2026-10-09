import type { RequestHandler } from './$types';
import { FIREBASE_AUTH_HELPER_ORIGIN } from '$lib/authDomain';

/**
 * Serves Firebase's sign-in helper pages (/__/auth/handler, /__/auth/iframe…)
 * from our own domain by passing them through to firebaseapp.com.
 *
 * Safari keeps a cross-site iframe's storage apart from the page around it, so
 * with the helpers on firebaseapp.com a redirect sign-in can't read its result
 * back. Same-origin, they're first-party. Firebase's documented "proxy" setup:
 * https://firebase.google.com/docs/auth/web/redirect-best-practices
 * It must be a transparent pass-through, not a redirect.
 */
const proxy: RequestHandler = async ({ request, url }) => {
	const target = new URL(url.pathname + url.search, FIREBASE_AUTH_HELPER_ORIGIN);

	const headers = new Headers(request.headers);
	headers.delete('host');
	headers.delete('cookie'); // our session cookie is none of Firebase's business

	const upstream = await fetch(target, {
		method: request.method,
		headers,
		body:
			request.method === 'GET' || request.method === 'HEAD'
				? undefined
				: await request.arrayBuffer(),
		redirect: 'manual'
	});

	// fetch has already decoded the body, so the upstream encoding and length
	// no longer describe what we send.
	const responseHeaders = new Headers(upstream.headers);
	responseHeaders.delete('content-encoding');
	responseHeaders.delete('content-length');

	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: responseHeaders
	});
};

export const GET = proxy;
export const POST = proxy;
