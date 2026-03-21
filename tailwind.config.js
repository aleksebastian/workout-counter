/** @type {import('tailwindcss').Config} */

import twTypography from '@tailwindcss/typography';
import daisyui from 'daisyui';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {}
	},
	plugins: [twTypography, daisyui]
};
