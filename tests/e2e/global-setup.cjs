/**
 * Global setup: wait out Playground's boot page, then log in once as the
 * blueprint's seeded admin (admin/password — disposable test site) and save
 * the storage state every test reuses. Tests must not depend on Playground's
 * auto-login: it is effectively first-client-wins, and any stray request
 * (including a readiness probe) can consume it.
 */
const path = require( 'path' );
const { chromium } = require( '@playwright/test' );

const STATE_PATH = path.join( __dirname, '.auth-state.json' );

module.exports = async ( config ) => {
	const base = config.projects[ 0 ].use.baseURL;

	// 1. Readiness: the login page renders real WordPress markup.
	const deadline = Date.now() + 300_000;
	let last = '';
	for ( ;; ) {
		if ( Date.now() > deadline ) {
			throw new Error( `Playground never became ready (${ last })` );
		}
		try {
			// redirect: manual — fetch has no cookie jar, so following the
			// auto-login redirect chain just loops. A 302 (auto-login) or a
			// 200 login form both mean WordPress is routing requests.
			const res = await fetch( base + '/wp-login.php', {
				redirect: 'manual',
			} );
			const text = await res.text();
			const booting = text.includes( 'WordPress is not ready yet' );
			if ( ! booting && ( res.status === 302 || ( res.ok && text.includes( 'loginform' ) ) ) ) {
				break;
			}
			last = `HTTP ${ res.status }${ booting ? ' (booting)' : '' }`;
		} catch ( err ) {
			last = err.message;
		}
		await new Promise( ( r ) => setTimeout( r, 5000 ) );
	}

	// 2. Explicit login → storage state.
	const browser = await chromium.launch();
	const page = await browser.newPage( { baseURL: base } );
	await page.goto( '/wp-login.php', { timeout: 120_000 } );
	if ( page.url().includes( 'wp-login.php' ) ) {
		await page.fill( '#user_login', 'admin' );
		await page.fill( '#user_pass', 'password' );
		await Promise.all( [
			page.waitForURL( /wp-admin/, { timeout: 120_000 } ),
			page.click( '#wp-submit' ),
		] );
	}
	await page.context().storageState( { path: STATE_PATH } );
	await browser.close();
};

module.exports.STATE_PATH = STATE_PATH;
