import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter(),

		// Report-only for now: violations go to /api/csp-report (the server log)
		// and to the console, and nothing is blocked. Enforce it once real
		// devices have run it — sign-in especially — without reports.
		csp: {
			reportOnly: {
				'default-src': ['self'],
				// Google's sign-in popup loads its helper script from apis.google.com.
				'script-src': ['self', 'https://apis.google.com'],
				// Svelte transitions and style attributes need inline styles.
				'style-src': ['self', 'unsafe-inline'],
				// Photo-import previews are blob: URLs; Google avatars are on googleusercontent.
				'img-src': ['self', 'data:', 'blob:', 'https://*.googleusercontent.com'],
				'font-src': ['self'],
				'connect-src': ['self', 'https://*.googleapis.com', 'https://apis.google.com'],
				// Firebase Auth's hidden iframe and Google's account chooser.
				'frame-src': [
					'https://workout-counter-99d56.firebaseapp.com',
					'https://accounts.google.com'
				],
				'worker-src': ['self'],
				'manifest-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none'],
				'report-uri': ['/api/csp-report']
			}
		}
	},

	compilerOptions: {
		runes: true
	}
};

export default config;
