/**
 * Visual regression (spec FR5): committed baselines for the variation sidebar
 * panels, the Tools → Block Variations row, and a propagated front-end render.
 *
 * Baselines are platform-suffixed by Playwright (-win32 / -linux); regenerate
 * with `npx playwright test tests/e2e/visual.spec.js --update-snapshots` on
 * the matching platform. Dynamic regions (dates) are masked.
 */
import { test, expect } from '@playwright/test';

const VISUAL_TITLE = 'Visual baseline hero';
const INSTANCE_SLUG = 'bvm-visual-instance';

function canvas( page ) {
	return page.frameLocator( 'iframe[name="editor-canvas"]' );
}

/**
 * Idempotent fixtures, created through the plugin's own REST API from an
 * admin page (nonce-authenticated): one fixed-name variation and one
 * published post linked to it.
 */
/**
 * Load the post editor and wait until its UI is actually usable (canvas
 * iframe + Settings toggle). A cold Playground can serve a partial page that
 * never finishes mounting, so reload and retry instead of waiting on one
 * load.
 */
async function openEditor( page ) {
	for ( let attempt = 0; attempt < 10; attempt++ ) {
		await page
			.goto( '/wp-admin/post-new.php', { timeout: 60_000 } )
			.catch( () => {} );
		const ready = await Promise.all( [
			page
				.waitForFunction( () => !! window.wp?.apiFetch, null, {
					timeout: 30_000,
				} )
				.then( () => true )
				.catch( () => false ),
			page
				.getByRole( 'button', { name: 'Settings', exact: true } )
				.waitFor( { timeout: 30_000 } )
				.then( () => true )
				.catch( () => false ),
		] );
		if ( ready.every( Boolean ) ) {
			return;
		}
	}
	throw new Error( 'Editor never became ready on /wp-admin/post-new.php' );
}

async function ensureFixtures( page ) {
	await openEditor( page );
	return await page.evaluate(
		async ( { title, slug } ) => {
			const api = window.wp.apiFetch;
			let [ variation ] = (
				await api( {
					path: '/bvm/v1/variations?block_type=core/heading',
				} )
			 ).filter( ( v ) => v.title === title );
			if ( ! variation ) {
				variation = await api( {
					path: '/bvm/v1/variations',
					method: 'POST',
					data: {
						title,
						block_type: 'core/heading',
						attrs: { level: 3, content: 'Visual hero' },
						content:
							'<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">Visual hero</h3><!-- /wp:heading -->',
					},
				} );
			}

			const existing = await api( {
				path: `/wp/v2/posts?slug=${ slug }&status=publish`,
			} );
			let post = existing[ 0 ];
			if ( ! post ) {
				post = await api( {
					path: '/wp/v2/posts',
					method: 'POST',
					data: {
						title: 'Visual instance post',
						slug,
						status: 'publish',
						content: `<!-- wp:heading {"level":3,"bvmVariationId":${ variation.id }} --><h3 class="wp-block-heading">Visual hero</h3><!-- /wp:heading -->`,
					},
				} );
			}
			return { variationId: variation.id, postId: post.id };
		},
		{ title: VISUAL_TITLE, slug: INSTANCE_SLUG }
	);
}

test.describe( 'visual baselines', () => {
	// Cold-start allowance (first test pays the Playground warm-up).
	test.describe.configure( { timeout: 300_000 } );

	test( 'variation sidebar panels', async ( { page } ) => {
		// ensureFixtures leaves us on a ready, untouched post-new.php.
		await ensureFixtures( page );
		await expect(
			page.locator( 'iframe[name="editor-canvas"]' )
		).toBeVisible( { timeout: 60_000 } );

		await page.evaluate( () => {
			const { dispatch } = window.wp.data;
			const block = window.wp.blocks.createBlock( 'core/heading', {
				level: 3,
				content: 'Visual hero',
			} );
			dispatch( 'core/block-editor' ).insertBlocks( block );
			dispatch( 'core/block-editor' ).selectBlock( block.clientId );
		} );

		const settingsToggle = page.getByRole( 'button', {
			name: 'Settings',
			exact: true,
		} );
		if (
			( await settingsToggle.getAttribute( 'aria-pressed' ) ) !== 'true'
		) {
			await settingsToggle.click();
		}
		await page.getByRole( 'tab', { name: 'Block' } ).click();

		for ( const name of [ 'Variation source', 'Save as variation' ] ) {
			const toggle = page.getByRole( 'button', { name } );
			if ( ( await toggle.getAttribute( 'aria-expanded' ) ) !== 'true' ) {
				await toggle.click();
			}
		}
		// Panel data loaded: the Apply select is populated.
		await expect(
			page.getByRole( 'combobox', { name: 'Apply' } )
		).toBeVisible();

		// Clip to the two plugin panels (wrapper of the Variation source
		// toggle's PanelBody and everything to the Save panel's end), via the
		// sidebar region to keep width stable.
		await expect(
			page.getByRole( 'region', { name: 'Editor settings' } )
		).toHaveScreenshot( 'variation-panels.png' );
	} );

	test( 'tools listing row', async ( { page } ) => {
		await ensureFixtures( page );
		await page.goto( '/wp-admin/edit.php?post_type=bvm_variation' );
		const row = page
			.getByRole( 'row' )
			.filter( { hasText: VISUAL_TITLE } )
			.first();
		await expect( row ).toBeVisible();
		await expect( row ).toHaveScreenshot( 'tools-listing-row.png', {
			// Publish date drifts with the calendar.
			mask: [ row.locator( 'td.date' ) ],
		} );
	} );

	test( 'propagated front-end render', async ( { page } ) => {
		const { postId } = await ensureFixtures( page );
		await page.goto( `/?p=${ postId }` );
		const heading = page
			.locator( 'h3.wp-block-heading' )
			.filter( { hasText: 'Visual hero' } );
		await expect( heading ).toBeVisible();
		await expect( heading ).toHaveScreenshot( 'front-end-heading.png' );
	} );
} );
