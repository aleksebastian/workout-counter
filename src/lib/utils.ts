import type { User } from 'firebase/auth';

/** "set" for 1, "sets" otherwise. Only regular plurals — every noun this app counts. */
export function plural(n: number, word: string): string {
	return n === 1 ? word : `${word}s`;
}

/** "1 set", "3 sets". */
export function counted(n: number, word: string): string {
	return `${n} ${plural(n, word)}`;
}

/**
 * A random id (a v4 UUID). `crypto.randomUUID` needs a secure context, which
 * a dev server opened over the LAN (plain http) isn't, so there it's built
 * from `getRandomValues`, which works everywhere.
 */
export function newId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	const b = crypto.getRandomValues(new Uint8Array(16));
	b[6] = (b[6] & 0x0f) | 0x40; // version 4
	b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
	const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A moment as a `datetime-local` input's value: local time, to the minute. */
export function datetimeLocal(date: Date | string): string {
	const d = new Date(date);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function getUserInitials(user: User) {
	if (user) {
		const name = user.displayName;
		const initials = name
			?.split(' ')
			.map((n) => n[0])
			.join('');

		return initials;
	}
	return '';
}

/**
 * Why `name` can't be used for a new or renamed item, or `undefined` if it can.
 * `existing` should leave out the item being renamed; names compare case-insensitively.
 */
export function getNameValidationMsg(
	kind: 'Workout' | 'Routine' | 'Program',
	name: string,
	existing: { name: string }[] | null | undefined
): string | undefined {
	const trimmed = name.trim().toLowerCase();
	if (!trimmed) return `${kind} name missing`;
	if (existing?.some((item) => item.name.toLowerCase() === trimmed)) {
		return `${kind} already exists`;
	}
	return undefined;
}

/**
 * Converts a URL-safe base64 string to a Uint8Array.
 * Required by pushManager.subscribe({ applicationServerKey }) which expects
 * the VAPID public key as a Uint8Array, not a string.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	const buffer = new ArrayBuffer(rawData.length);
	const view = new Uint8Array(buffer);
	for (let i = 0; i < rawData.length; i++) {
		view[i] = rawData.charCodeAt(i);
	}
	return view;
}
