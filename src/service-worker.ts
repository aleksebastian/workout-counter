/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `cache-${version}`;

const ASSETS = [
	...build, // the app itself (hashed filenames)
	...files  // everything in `static`
];

// Hostnames whose requests the SW must never intercept.
// The Firebase SDK manages its own offline persistence via IndexedDB —
// caching these responses in the SW cache corrupts auth tokens and stale data.
const BYPASS_HOSTNAMES = [
	'firestore.googleapis.com',
	'identitytoolkit.googleapis.com',
	'securetoken.googleapis.com',
	'firebase.googleapis.com',
	'firebaseio.com',
	'googleapis.com',
	'gstatic.com'
];

// ─── Lifecycle ────────────────────────────────────────────────────────────────

sw.addEventListener('install', (event) => {
	async function precache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}
	event.waitUntil(precache());
});

sw.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}
	event.waitUntil(deleteOldCaches().then(() => sw.clients.claim()));
});

// Allow the layout to command the waiting SW to take over immediately.
sw.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') {
		sw.skipWaiting();
	}
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Let Firebase/Google API calls pass through completely — no SW involvement.
	if (BYPASS_HOSTNAMES.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
		return;
	}

	event.respondWith(respond(event.request, url));
});

async function respond(request: Request, url: URL): Promise<Response> {
	const cache = await caches.open(CACHE);

	// ── Cache-first for versioned build assets & static files ──────────────────
	// These are safe to serve forever — filenames include a content hash.
	if (ASSETS.includes(url.pathname)) {
		const cached = await cache.match(url.pathname);
		if (cached) return cached;
	}

	// ── Stale-while-revalidate for SvelteKit data requests ────────────────────
	// SvelteKit client-side navigation fetches /<route>/__data.json for server
	// load data. These are NOT navigate-mode requests, so they'd fall through to
	// network-first. For uncached routes offline this causes a fetch failure and
	// SvelteKit renders its bare default error page. Fix: treat them like the
	// navigation handler — stale-while-revalidate, with a cross-route fallback
	// (valid since the layout server returns identical { userData: undefined }
	// for all non-login routes).
	if (url.pathname.endsWith('/__data.json')) {
		const cached = await cache.match(request);

		const networkPromise = fetch(request).then((response) => {
			if (response.status === 200) {
				cache.put(request, response.clone());
			}
			return response;
		}).catch(() => null);

		if (cached) {
			networkPromise.catch(() => {});
			return cached;
		}

		const fresh = await networkPromise;
		if (fresh) return fresh;

		// Offline and this exact URL was never cached — return any cached
		// __data.json response as a stand-in (layout data is route-agnostic).
		const allKeys = await cache.keys();
		for (const key of allKeys) {
			if (new URL(key.url).pathname.endsWith('/__data.json')) {
				const fallback = await cache.match(key);
				if (fallback) return fallback;
			}
		}

		return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
	}

	// ── Stale-while-revalidate for navigation (HTML) ───────────────────────────
	// Return the cached shell instantly so the app paints immediately, then
	// update the cache in the background so the *next* visit gets fresh HTML.
	if (request.mode === 'navigate') {
		const cached = await cache.match(request);

		const networkPromise = fetch(request).then((response) => {
			if (response.status === 200) {
				cache.put(request, response.clone());
			}
			return response;
		}).catch(() => null);

		// Return the cached version immediately if available, otherwise wait.
		if (cached) {
			// Fire-and-forget the background refresh.
			networkPromise.catch(() => {});
			return cached;
		}

		const fresh = await networkPromise;
		if (fresh) return fresh;

		// Absolute fallback: serve the app root from cache (SPA shell).
		const root = await cache.match('/');
		if (root) return root;

		return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
	}

	// ── Network-first with cache fallback for everything else ──────────────────
	try {
		const response = await fetch(request);

		if (!(response instanceof Response)) {
			throw new Error('invalid response from fetch');
		}

		if (response.status === 200) {
			cache.put(request, response.clone());
		}

		return response;
	} catch {
		const cached = await cache.match(request);
		if (cached) return cached;
		throw new Error(`No network and no cache for: ${url.pathname}`);
	}
}
