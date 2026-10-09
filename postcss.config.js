export default {
	plugins: {
		// CSS is minified by Vite (Lightning CSS), and Tailwind v4 adds vendor
		// prefixes itself. cssnano's calc reducer also choked on daisyUI's
		// mod()/round() and logged a lexical error for each on every build.
		'@tailwindcss/postcss': {}
	}
};
