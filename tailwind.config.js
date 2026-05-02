/** @type {import('tailwindcss').Config} */

import twTypography from '@tailwindcss/typography';
import daisyui from 'daisyui';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			zIndex: {
				1000: '1000'
			}
		}
	},
	plugins: [twTypography, daisyui]
};
