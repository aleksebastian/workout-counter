/**
 * What the app should report for notifications. A device whose permission is
 * granted but which has no push subscription can't be notified, so it reads
 * as `default` — not yet enabled — and everything that offers "Enable" offers
 * it again.
 */
export function effectiveNotifStatus<T extends string>(
	status: T,
	needsTap: boolean
): T | 'default' {
	return needsTap && status === 'granted' ? 'default' : status;
}
