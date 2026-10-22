/**
 * The product's core promise, end to end (QUA-5): a variation edit reaches a
 * linked instance through the editor-sync channel, per-instance overrides
 * survive it, the link really lives in post_content, and the REST surface
 * denies anonymous writes.
 *
 * Fixtures are created per run (timestamped) through the plugin's own REST
 * API from the authenticated editor page.
 */
import { test, expect } from '@playwright/test';
import { openEditor, restCall } from './helpers.js';

const STAMP = Date.now();
const TITLE = `Journey hero ${ STAMP }`;

let variationId;
let instanceId;

test.describe.serial( 'propagation journey', () => {
	// Cold-start allowance (this file runs first alphabetically and pays the
	// Playground warm-up).
	test.describe.configure( { timeout: 300_000 } );

	test( 'fixture: variation + linked instance via REST', async ( { page } ) => {
		await openEditor( page );

		const variation = await restCall( page, {
			path: '/bvm/v1/variations',
			method: 'POST',
			data: {
				title: TITLE,
				block_type: 'core/heading',
				attrs: { level: 3, content: `Original ${ STAMP }` },
				content: `<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">Original ${ STAMP }</h3><!-- /wp:heading -->`,
			},
		} );
		expect( variation.id ).toBeGreaterThan( 0 );
		variationId = variation.id;

		const instance = await restCall( page, {
			path: '/wp/v2/posts',
			method: 'POST',
			data: {
				title: `Journey instance ${ STAMP }`,
				status: 'publish',
				content: `<!-- wp:heading {"level":3,"bvmVariationId":${ variationId }} --><h3 class="wp-block-heading">Original ${ STAMP }</h3><!-- /wp:heading -->`,
			},
		} );
		expect( instance.id ).toBeGreaterThan( 0 );
		instanceId = instance.id;

		// The link is REAL serialized state, not editor-session state.
		const raw = await restCall( page, {
			path: `/wp/v2/posts/${ instanceId }?context=edit`,
		} );
		expect( raw.content.raw ).toContain(
			`"bvmVariationId":${ variationId }`
		);
	} );

	test( 'editing the variation updates the instance in the editor', async ( { page } ) => {
		await openEditor( page );
		await restCall( page, {
			path: `/bvm/v1/variations/${ variationId }`,
			method: 'PUT',
			data: { attrs: { level: 2, content: `Propagated ${ STAMP }` } },
		} );

		// Open the instance post: the editor-sync channel (track-overrides)
		// must write the variation's current attrs into the store.
		await openEditor(
			page,
			`/wp-admin/post.php?post=${ instanceId }&action=edit`
		);
		await page.waitForFunction(
			( { expected } ) => {
				const blocks = window.wp.data
					.select( 'core/block-editor' )
					.getBlocks();
				const heading = blocks.find(
					( b ) => b.name === 'core/heading'
				);
				return (
					!! heading &&
					String( heading.attributes.content ) === expected &&
					heading.attributes.level === 2
				);
			},
			{ expected: `Propagated ${ STAMP }` },
			{ timeout: 60_000 }
		);
	} );

	test( 'a per-instance override survives the next variation edit', async ( { page } ) => {
		// Programmatic updateBlockAttributes bypasses the wrapped setAttributes
		// by design (§10 known limitation), so the override is baked into a
		// fixture instance the way a user edit would have serialized it.
		await openEditor( page );
		const overridden = await restCall( page, {
			path: '/wp/v2/posts',
			method: 'POST',
			data: {
				title: `Journey override instance ${ STAMP }`,
				status: 'publish',
				content: `<!-- wp:heading {"level":5,"bvmVariationId":${ variationId },"bvmOverriddenAttrs":["level"]} --><h5 class="wp-block-heading">Original ${ STAMP }</h5><!-- /wp:heading -->`,
			},
		} );

		// The variation moves on; the overridden level must not follow, while
		// the non-overridden content must.
		await restCall( page, {
			path: `/bvm/v1/variations/${ variationId }`,
			method: 'PUT',
			data: { attrs: { level: 4, content: `Round two ${ STAMP }` } },
		} );
		await openEditor(
			page,
			`/wp-admin/post.php?post=${ overridden.id }&action=edit`
		);
		await page.waitForFunction(
			( { expected } ) => {
				const heading = window.wp.data
					.select( 'core/block-editor' )
					.getBlocks()
					.find( ( b ) => b.name === 'core/heading' );
				return (
					!! heading &&
					String( heading.attributes.content ) === expected &&
					heading.attributes.level === 5 &&
					( heading.attributes.bvmOverriddenAttrs || [] ).includes( 'level' )
				);
			},
			{ expected: `Round two ${ STAMP }` },
			{ timeout: 60_000 }
		);
	} );

	test( 'anonymous requests cannot touch the API', async ( { browser } ) => {
		// A fresh context with no storage state = logged out.
		const anonymous = await browser.newContext( { storageState: undefined } );
		const destroy = await anonymous.request.delete(
			`/?rest_route=/bvm/v1/variations/${ variationId }`
		);
		expect( [ 401, 403 ] ).toContain( destroy.status() );
		const read = await anonymous.request.get(
			`/?rest_route=/wp/v2/block-variation-manager/${ variationId }`
		);
		expect( read.status() ).toBe( 401 ); // SEC-3 gate, live
		await anonymous.close();
	} );
} );
