/**
 * Visual regression (spec FR5): committed baselines for the variation sidebar
 * panels, the Tools → Block Variations row, and a linked heading's front-end
 * render.
 *
 * Baselines are platform-suffixed by Playwright (-win32 / -linux); regenerate
 * with `npx playwright test tests/e2e/visual.spec.js --update-snapshots` on
 * the matching platform (linux: the pinned CI container — see tests.yml).
 * Dynamic regions (dates) are masked; row-actions are hidden (their height
 * depends on hover detection). The E2E server pins the WordPress version
 * (scripts/playground-e2e.mjs) so baselines don't drift with core releases.
 */
import { test, expect } from '@playwright/test';
import { openEditor, openSettingsSidebar, openPanel } from './helpers.js';

const VISUAL_TITLE = 'Visual baseline hero';
const INSTANCE_SLUG = 'bvm-visual-instance';

/**
 * Idempotent fixtures, created through the plugin's own REST API from an
 * authenticated editor page: one fixed-name variation and one published post
 * linked to it.
 */
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

		await openSettingsSidebar( page );
		for ( const name of [ 'Variation source', 'Save as variation' ] ) {
			await openPanel( page, name );
		}
		// Panel data loaded: the Apply select is populated.
		await expect(
			page.getByRole( 'combobox', { name: 'Apply' } )
		).toBeVisible();

		// The whole settings region is the baseline: it includes core's own
		// inspector panels around the two plugin panels, which is deliberate —
		// a layout clash WITH core chrome is exactly what this shot catches.
		await expect(
			page.getByRole( 'region', { name: 'Editor settings' } )
		).toHaveScreenshot( 'variation-panels.png' );
	} );

	test( 'tools listing row', async ( { page } ) => {
		await ensureFixtures( page );
		// Search-filtered view: other tests create variations too, and the
		// row's position (and alternate-row striping) must stay deterministic.
		await page.goto(
			'/wp-admin/edit.php?post_type=bvm_variation&s=' +
				encodeURIComponent( VISUAL_TITLE )
		);
		// Row-actions ("Edit | Quick Edit | …") reserve height only when the
		// environment reports hover support, which varies between headless
		// runs — hide them so the row height is deterministic.
		await page.addStyleTag( {
			content: '.row-actions { display: none !important; }',
		} );
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

	// QUA-4: honestly named — this is a static render baseline of a LINKED
	// heading (the merge/bake channels are exercised by the propagation
	// journey spec and the PHP suites, not by this screenshot).
	test( 'linked heading front-end baseline', async ( { page } ) => {
		const { postId } = await ensureFixtures( page );
		await page.goto( `/?p=${ postId }` );
		const heading = page
			.locator( 'h3.wp-block-heading' )
			.filter( { hasText: 'Visual hero' } );
		await expect( heading ).toBeVisible();
		await expect( heading ).toHaveScreenshot( 'front-end-heading.png' );
	} );
} );
