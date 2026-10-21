const defaultConfig = require( '@wordpress/scripts/config/jest-unit.config.js' );

module.exports = {
	...defaultConfig,
	testMatch: [ '<rootDir>/tests/js/**/*.test.js' ],
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
