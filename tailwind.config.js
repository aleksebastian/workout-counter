/** @type {import('tailwindcss').Config} */

import twTypography from '@tailwindcss/typography';
import daisyui from 'daisyui';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {}
	},
	plugins: [twTypography, daisyui],
	daisyui: {
		themes: ['emerald', 'dracula'], // false: only light + dark | true: all themes | array: specific themes like this ["light", "dark", "cupcake"]
		darkTheme: 'dracula' // name of one of the included themes for dark mode
	}
};
