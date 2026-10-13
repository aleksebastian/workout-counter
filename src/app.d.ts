// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import '@poppanator/sveltekit-svg/dist/svg.d.ts';

declare global {
	/** package.json version, injected by vite.config.ts. */
	const __APP_VERSION__: string;

	interface Window {
		__backButtonClicked?: boolean;
	}

	namespace App {
		// interface Error {}
		interface Locals {
			userID: string | null;
		}
		// interface PageData {}
		interface PageState {
			/** The full-screen account screen is open (shallow-routed from the avatar). */
			account?: boolean;
		}
		// interface Platform {}
	}
}

export {};
