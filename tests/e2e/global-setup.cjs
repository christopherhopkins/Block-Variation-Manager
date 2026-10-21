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

	// 2. Explicit login → storage state, VERIFIED: the state is only saved
	// once /wp-admin/ actually renders the admin bar with it. Playground's
	// session handling flakes right after boot, so retry the whole cycle.
	const browser = await chromium.launch();
	const page = await browser.newPage( { baseURL: base } );
	let authed = false;
	for ( let attempt = 0; attempt < 8 && ! authed; attempt++ ) {
		// reauth=1 forces the form even when Playground's auto-login would
		// redirect — the session must come from real credentials + cookie,
		// not the one-shot auto-login.
		await page
			.goto( '/wp-login.php?reauth=1', { timeout: 120_000 } )
			.catch( () => {} );
		if (
			await page
				.locator( '#user_login' )
				.isVisible( { timeout: 5_000 } )
				.catch( () => false )
		) {
			// Blueprint-seeded admin of the disposable Playground site.
			await page.fill( '#user_login', 'admin' );
			await page.fill( '#user_pass', 'password' );
			await page.click( '#wp-submit' );
			await page
				.waitForURL( /wp-admin/, { timeout: 60_000 } )
				.catch( () => {} );
		}
		await page
			.goto( '/wp-admin/', { timeout: 120_000 } )
			.catch( () => {} );
		const adminBar = await page
			.locator( '#wpadminbar' )
			.isVisible( { timeout: 10_000 } )
			.catch( () => false );
		const cookies = await page.context().cookies();
		authed =
			adminBar &&
			cookies.some( ( c ) => c.name.startsWith( 'wordpress_logged_in' ) );
		if ( ! authed ) {
			await new Promise( ( r ) => setTimeout( r, 5000 ) );
		}
	}
	if ( ! authed ) {
		await browser.close();
		throw new Error( 'Could not establish an authenticated admin session' );
	}
	await page.context().storageState( { path: STATE_PATH } );
	await browser.close();
};

module.exports.STATE_PATH = STATE_PATH;
