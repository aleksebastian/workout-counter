import type { Preferences } from '$lib/types';

/** daisyUI theme names backing each user-facing choice. */
const THEMES = { light: 'emerald', dark: 'dracula' } as const;

/**
 * `system` removes the attribute entirely so the CSS media query takes over —
 * that's why this isn't just a `setAttribute`.
 */
export function applyTheme(theme: Preferences['theme']) {
	if (typeof document === 'undefined') return;
	const daisyTheme = theme === 'light' || theme === 'dark' ? THEMES[theme] : null;
	if (daisyTheme) {
		document.documentElement.setAttribute('data-theme', daisyTheme);
	} else {
		document.documentElement.removeAttribute('data-theme');
	}
}
