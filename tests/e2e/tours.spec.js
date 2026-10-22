/**
 * Onboarding tours (track onboarding-tours_20261022, FR-2/FR-5): the
 * management-screen tour auto-starts exactly once per user, persists its
 * dismissal through user meta, and relaunches on demand.
 *
 * global-setup pre-completes every tour for the shared admin so other specs
 * never meet an auto-started overlay; this spec resets that state to test
 * the fresh-user path and restores it at the end.
 */
import { test, expect } from '@playwright/test';

const LIST_URL = '/wp-admin/edit.php?post_type=bvm_variation';
const ALL_DONE = {
	management: true,
	'editor-panel': true,
	'variation-editor': true,
};

async function openList( page ) {
	await page.goto( LIST_URL, { timeout: 120_000 } );
	await page.waitForFunction( () => !! window.wp?.apiFetch, null, {
		timeout: 60_000,
	} );
}

function setTourMeta( page, map ) {
	return page.evaluate(
		( meta ) =>
			window.wp.apiFetch( {
				path: '/wp/v2/users/me',
				method: 'POST',
				data: { meta: { bvm_tours_completed: meta } },
			} ),
		map
	);
}

test.describe.serial( 'management-screen onboarding tour', () => {
	// First test may pay the Playground warm-up.
	test.describe.configure( { timeout: 300_000 } );

	test( 'auto-starts once for a fresh user and persists dismissal', async ( {
		page,
	} ) => {
		await openList( page );
		await setTourMeta( page, {} ); // fresh user
		await page.reload();

		const popover = page.locator( '.driver-popover.bvm-tour' );
		await expect( popover ).toBeVisible( { timeout: 60_000 } );
		await expect( popover ).toContainText( 'Welcome to Block Variations' );

		await page.locator( '.driver-popover-close-btn' ).click();
		await expect( popover ).toBeHidden();

		// Dismissal round-trips through core user meta (survives browsers).
		await expect
			.poll(
				() =>
					page.evaluate( () =>
						window.wp
							.apiFetch( { path: '/wp/v2/users/me?context=edit' } )
							.then(
								( u ) =>
									u.meta?.bvm_tours_completed?.management ===
									true
							)
					),
				{ timeout: 30_000 }
			)
			.toBe( true );
	} );

	test( 'does not auto-start again after a reload', async ( { page } ) => {
		await openList( page );
		await expect( page.locator( 'button.bvm-tour-start' ) ).toBeVisible();
		// Grace period: the auto-start fires on dom-ready, so give it ample
		// room to (wrongly) appear before asserting it did not.
		await page.waitForTimeout( 2_000 );
		await expect(
			page.locator( '.driver-popover.bvm-tour' )
		).toBeHidden();
	} );

	test( 'Start tour relaunches on demand', async ( { page } ) => {
		await openList( page );
		await page.locator( 'button.bvm-tour-start' ).click();
		await expect(
			page.locator( '.driver-popover.bvm-tour' )
		).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await expect(
			page.locator( '.driver-popover.bvm-tour' )
		).toBeHidden();

		// Restore the all-complete state global-setup established, so later
		// specs (visual baselines included) never meet an auto-start.
		await setTourMeta( page, ALL_DONE );
	} );
} );
