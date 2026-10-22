/**
 * Shared E2E helpers (QUA-19 — previously duplicated across specs with
 * diverging readiness logic).
 */
import { expect } from '@playwright/test';

/** The block editor canvas lives in an iframe on modern WP. */
export function canvas( page ) {
	return page.frameLocator( 'iframe[name="editor-canvas"]' );
}

/**
 * Load the post editor and wait until its UI is actually usable (canvas
 * iframe + Settings toggle). A cold Playground can serve a partial page that
 * never finishes mounting, so reload and retry — bounded by a deadline so a
 * genuine failure surfaces inside the test timeout.
 */
export async function openEditor( page, url = '/wp-admin/post-new.php' ) {
	// The first load on a cold Playground compiles the whole editor and can
	// take minutes — reloading mid-compile restarts it, so the FIRST attempt
	// waits long without reloading; later attempts (the partial-page case,
	// where the served document never becomes the editor) reload with short
	// windows.
	const deadline = Date.now() + 240_000;
	let waitMs = 120_000;
	while ( Date.now() < deadline ) {
		await page.goto( url, { timeout: 60_000 } ).catch( () => {} );
		const budget = Math.min( waitMs, Math.max( deadline - Date.now(), 5_000 ) );
		const scriptsUp = await page
			.waitForFunction( () => !! window.wp?.apiFetch, null, {
				timeout: budget,
			} )
			.then( () => true )
			.catch( () => false );
		if ( scriptsUp ) {
			// The welcome guide modal marks the whole app shell aria-hidden,
			// which hides the Settings button from role queries — dismiss it
			// BEFORE waiting on the header.
			await dismissWelcomeGuide( page );
			const headerUp = await page
				.getByRole( 'button', { name: 'Settings', exact: true } )
				.waitFor( { timeout: 30_000 } )
				.then( () => true )
				.catch( () => false );
			if ( headerUp ) {
				return;
			}
		}
		waitMs = 30_000;
	}
	throw new Error( `Editor never became ready on ${ url }` );
}

/** Close the welcome guide if (and only if) it is actually shown. */
export async function dismissWelcomeGuide( page ) {
	const guide = page.getByRole( 'dialog', { name: /Welcome/i } );
	// Give a just-booted editor a moment to mount the modal.
	await guide.waitFor( { timeout: 5_000 } ).catch( () => {} );
	if ( await guide.isVisible().catch( () => false ) ) {
		await guide.getByRole( 'button', { name: 'Close' } ).click();
		await guide.waitFor( { state: 'hidden', timeout: 10_000 } ).catch( () => {} );
	}
}

/** Open the Settings sidebar on the Block tab. */
export async function openSettingsSidebar( page ) {
	const settingsToggle = page.getByRole( 'button', {
		name: 'Settings',
		exact: true,
	} );
	if ( ( await settingsToggle.getAttribute( 'aria-pressed' ) ) !== 'true' ) {
		await settingsToggle.click();
	}
	await page.getByRole( 'tab', { name: 'Block' } ).click();
}

/** Expand a sidebar PanelBody when it is collapsed. */
export async function openPanel( page, name ) {
	const toggle = page.getByRole( 'button', { name } );
	if ( ( await toggle.getAttribute( 'aria-expanded' ) ) !== 'true' ) {
		await toggle.click();
	}
}

/**
 * Insert a selected core/heading via the block-editor store — deterministic,
 * and the subject under test is the plugin, not Gutenberg's typing flows.
 */
export async function insertHeading( page, text, attrs = {} ) {
	await page.evaluate(
		( { content, extra } ) => {
			const { dispatch } = window.wp.data;
			const block = window.wp.blocks.createBlock( 'core/heading', {
				level: 3,
				content,
				...extra,
			} );
			dispatch( 'core/block-editor' ).insertBlocks( block );
			dispatch( 'core/block-editor' ).selectBlock( block.clientId );
		},
		{ content: text, extra: attrs }
	);
	const heading = canvas( page ).getByRole( 'document', {
		name: /Block: Heading/,
	} );
	await expect( heading ).toBeVisible();
	return heading;
}

/** apiFetch from the authenticated editor page (nonce included). */
export async function restCall( page, options ) {
	const result = await page.evaluate(
		( opts ) =>
			window.wp
				.apiFetch( opts )
				.catch( ( err ) => ( { __error: err?.message || err?.code } ) ),
		options
	);
	// Fail at the call site: a swallowed REST error otherwise surfaces as an
	// unrelated 60s waitForFunction timeout further down the test.
	if ( result && result.__error ) {
		throw new Error(
			`REST ${ options.method || 'GET' } ${ options.path } failed: ${ result.__error }`
		);
	}
	return result;
}
