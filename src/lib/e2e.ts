import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '$lib/firebase';
import { finishSignIn } from '$lib/logic/auth';

declare global {
	interface Window {
		/** End-to-end tests only: signs in without Google's popup. */
		__e2eSignIn?: (customToken: string) => Promise<void>;
	}
}

/**
 * Hooks for the end-to-end tests, installed only when the app runs against
 * the Firebase emulators. Signing in goes through the real `finishSignIn`, so
 * the server session cookie is minted the same way as for a Google sign-in.
 */
export function installTestHooks() {
	window.__e2eSignIn = async (customToken) => {
		const { user } = await signInWithCustomToken(auth, customToken);
		await finishSignIn(user);
	};
}
