/**
 * localStorage keys that describe the signed-in account rather than the
 * device, so they go when the account leaves. Device-level keys — the theme,
 * whether notifications were offered, which release notes were seen — stay.
 */

/** The home screen's "setup complete" card was dismissed. */
export const SETUP_SEEN_KEY = 'sc-setup-complete-seen';
/** The "turn on a rest timer?" offer was answered either way. */
export const REST_OFFER_ANSWERED_KEY = 'sc-rest-offer-answered';

const ACCOUNT_KEYS = [SETUP_SEEN_KEY, REST_OFFER_ANSWERED_KEY];

export function forgetAccountStorage() {
	for (const key of ACCOUNT_KEYS) {
		try {
			localStorage.removeItem(key);
		} catch {
			// Storage unavailable: nothing was kept.
		}
	}
}
