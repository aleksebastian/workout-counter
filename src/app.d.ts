// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import '@poppanator/sveltekit-svg/dist/svg.d.ts';

declare global {
	interface Window {
		__backButtonClicked?: boolean;
	}

	namespace App {
		// interface Error {}
		interface Locals {
			userID: string | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
