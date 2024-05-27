export const ssr = false;

import type { LayoutLoad } from './$types';
import { isMobileDevice$ } from '$lib/store';

export const load: LayoutLoad = async () => {
	isMobileDevice$.set(window.navigator.userAgent.toLowerCase().includes('mobi'));
};
