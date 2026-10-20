import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import svg from '@poppanator/sveltekit-svg';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
	plugins: [sveltekit(), svg()],
	define: {
		// The release version, for bug reports. `version` from $app/environment
		// is the build id, which the update check relies on changing every deploy.
		__APP_VERSION__: JSON.stringify(pkg.version),
		// Builds for the end-to-end tests only (see playwright.config.ts). Fixed at
		// build time so every other build drops the emulator code and test hooks.
		__E2E__: JSON.stringify(process.env.PUBLIC_FIREBASE_EMULATORS === 'true')
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	build: {
		// The Firestore chunk below (Firestore plus the Firebase core it needs) is
		// ~535 kB minified on its own and can't be split further. Anything else
		// past this size is ours and should still warn.
		chunkSizeWarningLimit: 560,
		rolldownOptions: {
			output: {
				// The Firebase SDK is most of the app's JS and changes far less often
				// than our code. Keeping it in its own chunks means a deploy doesn't
				// make returning users download it again.
				codeSplitting: {
					groups: [
						{
							name: 'firebase-firestore',
							test: /node_modules[\\/].*(@firebase[\\/](firestore|webchannel-wrapper)|re2js)[\\/]/,
							priority: 3
						},
						{
							name: 'firebase-auth',
							test: /node_modules[\\/].*@firebase[\\/]auth[\\/]/,
							priority: 2
						},
						{
							name: 'firebase',
							test: /node_modules[\\/].*([\\/]firebase|@firebase[\\/][^\\/]+|[\\/]idb)[\\/]/,
							priority: 1
						}
					]
				}
			},
			// Rolldown's per-plugin timing report; informational only.
			checks: { pluginTimings: false }
		}
	}
});
