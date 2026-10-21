const defaultConfig = require( '@wordpress/scripts/config/jest-unit.config.js' );

module.exports = {
	...defaultConfig,
	testMatch: [ '<rootDir>/tests/js/**/*.test.js' ],
	// The plugin consumes @wordpress/* as webpack externals (window.wp.*), so
	// most of them aren't installed as packages. Map the missing ones to
	// lightweight test stubs; really-installed ones (element, hooks, compose,
	// i18n) are used for real.
	moduleNameMapper: {
		...( defaultConfig.moduleNameMapper ?? {} ),
		'^@wordpress/api-fetch$':
			'<rootDir>/tests/js/__mocks__/wp-api-fetch.js',
		'^@wordpress/data$': '<rootDir>/tests/js/__mocks__/wp-data.js',
		'^@wordpress/blocks$': '<rootDir>/tests/js/__mocks__/wp-blocks.js',
		'^@wordpress/block-editor$':
			'<rootDir>/tests/js/__mocks__/wp-block-editor.js',
		'^@wordpress/components$':
			'<rootDir>/tests/js/__mocks__/wp-components.js',
		'^@wordpress/plugins$': '<rootDir>/tests/js/__mocks__/wp-plugins.js',
		'^@wordpress/editor$': '<rootDir>/tests/js/__mocks__/wp-editor.js',
		'^@wordpress/dom-ready$':
			'<rootDir>/tests/js/__mocks__/wp-dom-ready.js',
	},
	collectCoverageFrom: [
		'source/**/*.js',
		// Entry point only wires filters/registrations together; exercised by E2E.
		'!source/entry.js',
	],
	coverageThreshold: {
		global: {
			statements: 80,
			branches: 80,
			functions: 80,
			lines: 80,
		},
	},
};
