import type { User } from 'firebase/auth';

export function getUserInitials(user: User) {
	if (user) {
		const name = user.displayName;
		const initials = name
			?.split(' ')
			.map((n) => n[0])
			.join('');

		return initials;
	}
}
