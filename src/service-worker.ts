/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `cache-${version}`;

const ASSETS = [
	...build, // the app itself (hashed filenames)
	...files // everything in `static`
];
/** For the per-request lookup; paths on this origin only. */
const ASSET_PATHS = new Set(ASSETS);

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

// ─── Push Notifications ───────────────────────────────────────────────────────

sw.addEventListener('push', (event) => {
	if (!event.data) return;

	// Only our server sends pushes, but a payload that isn't the JSON it sends
	// mustn't throw here: no notification would show, and Safari revokes a
	// subscription whose pushes don't show one. Defaults match _push.ts.
	let title = 'Rest Complete! 💪';
	let body = '';
	try {
		const payload = event.data.json() as { title?: unknown; body?: unknown };
		if (typeof payload.title === 'string') title = payload.title;
		if (typeof payload.body === 'string') body = payload.body;
	} catch {
		// Keep the defaults.
	}

	event.waitUntil(
		sw.registration.showNotification(title, {
			body,
			icon: '/icon-192x192.png',
			tag: 'rest-timer'
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();

	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			const existing = clientList.find((c) => c.url.startsWith(sw.location.origin));
			if (existing) return existing.focus();
			return sw.clients.openWindow('/');
		})
	);
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Only this app's own requests. Firebase and Google calls pass through
	// untouched — the Firebase SDK keeps its own offline cache in IndexedDB,
	// and caching its responses here corrupts auth tokens and serves stale
	// data — and other origins' files are never ours to cache.
	if (url.origin !== sw.location.origin) return;

	// SvelteKit's server data: the root layout's guard (the only server load)
	// runs on full page loads, which come through as navigations below. Kept
	// out of the cache, where an auth redirect would outlive the sign-in.
	if (url.pathname.endsWith('/__data.json')) return;

	event.respondWith(respond(event.request, url));
});

async function respond(request: Request, url: URL): Promise<Response> {
	const cache = await caches.open(CACHE);

	// ── Cache-first for versioned build assets & static files ──────────────────
	// These are safe to serve forever — filenames include a content hash.
	if (ASSET_PATHS.has(url.pathname)) {
		const cached = await cache.match(url.pathname);
		if (cached) return cached;
	}

	// ── Stale-while-revalidate for navigation (HTML) ───────────────────────────
	// Return the cached shell instantly so the app paints immediately, then
	// update the cache in the background so the *next* visit gets fresh HTML.
	if (request.mode === 'navigate') {
		const cached = await cache.match(request);

		const networkPromise = fetch(request)
			.then((response) => {
				if (response.status === 200) {
					cache.put(request, response.clone());
				}
				return response;
			})
			.catch(() => null);

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
