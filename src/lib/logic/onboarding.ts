export type MinimalUserData = {
	username?: string;
	photoURL?: string | null;
	preferences?: {
		timer?: { minutes?: number; seconds?: number };
		theme?: 'light' | 'dark' | 'system';
		weightUnit?: 'lbs' | 'kg';
		weekStart?: 0 | 1;
		weeklyGoal?: number;
		streaksEnabled?: boolean;
	};
};

export function getRequiredOnboardingRoute(pathname: string, userData: MinimalUserData | null | undefined) {
	if (!userData) {
		if (pathname.startsWith('/login')) return null;
		return '/login/username';
	}

	if (!userData.username) {
		if (pathname.startsWith('/login/username')) return null;
		return '/login/username';
	}

	if (!userData.preferences) {
		if (pathname.startsWith('/preferences')) return null;
		return '/preferences';
	}

	if (pathname.startsWith('/login')) return '/';
	return null;
}
