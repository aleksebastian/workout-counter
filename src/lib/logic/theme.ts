import type { Preferences } from '$lib/types';

/** daisyUI theme names backing each user-facing choice. */
const THEMES = { light: 'emerald', dark: 'dracula' } as const;

/** Each theme's base-100, which the installed iOS app's status bar paints in. */
const THEME_COLORS = { light: '#ffffff', dark: '#282a36' } as const;

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
	syncThemeColor(theme);
}

/**
 * app.html ships one theme-color per colour scheme. An explicit preference
 * overrides both, or the status bar keeps following the system scheme and
 * clashes with the page.
 */
function syncThemeColor(theme: Preferences['theme']) {
	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		const scheme = meta.media.includes('dark') ? 'dark' : 'light';
		meta.content =
			theme === 'light' || theme === 'dark' ? THEME_COLORS[theme] : THEME_COLORS[scheme];
	}
}
