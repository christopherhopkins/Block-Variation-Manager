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

	// 1. Readiness: the REST index must answer with JSON. This needs a tiny
	// cookie jar: Playground's auto-login interceptor 302s EVERY cookieless
	// request (REST included, and even while WordPress itself still shows
	// "WordPress is not ready yet"), so a bare status check passes long
	// before the site works — which once let the whole suite start against a
	// booting site. Cold boots (fresh CLI/WP caches) take minutes.
	const probe = async () => {
		let cookies = '';
		let url = base + '/?rest_route=/';
		for ( let hop = 0; hop < 5; hop++ ) {
			const res = await fetch( url, {
				redirect: 'manual',
				headers: {
					accept: 'application/json',
					...( cookies ? { cookie: cookies } : {} ),
				},
			} );
			const setc = res.headers.getSetCookie
				? res.headers.getSetCookie()
				: [];
			if ( setc.length ) {
				cookies = [ cookies, ...setc.map( ( c ) => c.split( ';' )[ 0 ] ) ]
					.filter( Boolean )
					.join( '; ' );
			}
			const text = await res.text();
			if ( text.includes( 'WordPress is not ready yet' ) ) {
				return 'booting';
			}
			if ( res.ok && text.trimStart().startsWith( '{' ) ) {
				return 'ready';
			}
			if ( res.status >= 300 && res.status < 400 ) {
				url = new URL( res.headers.get( 'location' ) || url, base ).href;
				continue;
			}
			return `HTTP ${ res.status }`;
		}
		return 'redirect loop';
	};

	const deadline = Date.now() + 420_000;
	let last = '';
	for ( ;; ) {
		if ( Date.now() > deadline ) {
			throw new Error( `Playground never became ready (${ last })` );
		}
		try {
			last = await probe();
			if ( 'ready' === last ) {
				break;
			}
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
	// 3. Pre-complete every onboarding tour for the shared admin: an
	// auto-started tour overlay would otherwise intercept clicks and pollute
	// visual baselines in unrelated specs. tours.spec.js resets this state
	// itself to test the fresh-user auto-start (and restores it afterwards).
	await page
		.goto( '/wp-admin/edit.php?post_type=bvm_variation', {
			timeout: 120_000,
		} )
		.catch( () => {} );
	const seeded = await page
		.waitForFunction( () => !! window.wp?.apiFetch, null, {
			timeout: 30_000,
		} )
		.then( () =>
			page.evaluate( () =>
				window.wp.apiFetch( {
					path: '/wp/v2/users/me',
					method: 'POST',
					data: {
						meta: {
							bvm_tours_completed: {
								management: true,
								'editor-panel': true,
								'variation-editor': true,
							},
						},
					},
				} )
			)
		)
		.then(
			() => true,
			() => false
		);
	if ( ! seeded ) {
		await browser.close();
		throw new Error( 'Could not pre-complete onboarding tours' );
	}

	await page.context().storageState( { path: STATE_PATH } );
	await browser.close();
};

module.exports.STATE_PATH = STATE_PATH;
