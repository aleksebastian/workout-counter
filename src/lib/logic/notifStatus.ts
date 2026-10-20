/**
 * What the app should report for notifications. A device whose permission reads
 * as granted but where the system won't subscribe can't be notified, so it reads
 * as `default` — not yet enabled — and everything that offers "Enable" offers
 * it again.
 */
export function effectiveNotifStatus<T extends string>(status: T, blocked: boolean): T | 'default' {
	return blocked && status === 'granted' ? 'default' : status;
}
