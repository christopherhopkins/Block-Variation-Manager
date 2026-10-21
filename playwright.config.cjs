const { defineConfig } = require( '@playwright/test' );

const PORT = process.env.BVM_E2E_PORT || '9488';

module.exports = defineConfig( {
	testDir: './tests/e2e',
	globalSetup: require.resolve( './tests/e2e/global-setup.cjs' ),
	timeout: 120_000,
	expect: {
		timeout: 15_000,
		toHaveScreenshot: {
			// Font antialiasing drifts between runs; small tolerance keeps
			// baselines stable without masking layout regressions.
			maxDiffPixelRatio: 0.02,
		},
	},
	// Playground is one shared WordPress instance — tests must not race it.
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	use: {
		baseURL: `http://127.0.0.1:${ PORT }`,
		viewport: { width: 1280, height: 900 },
		trace: 'retain-on-failure',
		// Written by global-setup.cjs (explicit admin login).
		storageState: require( 'path' ).join(
			__dirname,
			'tests/e2e/.auth-state.json'
		),
	},
	webServer: {
		command: 'node scripts/playground-e2e.mjs',
		// TCP check, not a URL: Playground's auto-login answers plain GETs
		// with redirects, which stalls Playwright's URL readiness probe.
		port: Number( PORT ),
		reuseExistingServer: true,
		// First boot downloads WordPress + Kadence.
		timeout: 300_000,
	},
} );
