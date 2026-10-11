import { sendPushToUser } from './_push';

/**
 * Dev stand-in for QStash: rest-end pushes scheduled in this server process.
 * Kept here so the cancel route can clear what the schedule route set —
 * otherwise a rest that was stopped or skipped still notified.
 */
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleDevPush(uid: string, delayMs: number): string {
	const id = `dev-${uid}-${Date.now()}`;
	timers.set(
		id,
		setTimeout(() => {
			timers.delete(id);
			// A failed push must not be an unhandled rejection: that exits the
			// whole dev server, and every page then fails with a 500.
			sendPushToUser(uid).catch((err) => console.error('[push] dev send failed:', err));
		}, delayMs)
	);
	return id;
}

export function cancelDevPush(id: string) {
	clearTimeout(timers.get(id));
	timers.delete(id);
}
