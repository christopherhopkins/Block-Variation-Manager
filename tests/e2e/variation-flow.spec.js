/**
 * Core flow (spec FR3): save a block as a variation from the sidebar panel,
 * apply it to another block, and confirm the link + the Tools listing.
 *
 * Runs against WordPress Playground with the working tree mounted
 * (scripts/playground-e2e.mjs); the blueprint auto-logs-in as admin.
 */
import { test, expect } from '@playwright/test';
import {
	canvas,
	openEditor,
	openSettingsSidebar,
	openPanel,
	insertHeading,
} from './helpers.js';

const VARIATION_NAME = `E2E hero ${ Date.now() }`;

const openNewPost = ( page ) => openEditor( page );

test.describe.serial( 'variation lifecycle', () => {
	test( 'save a heading as a variation', async ( { page } ) => {
		await openNewPost( page );
		await canvas( page )
			.getByRole( 'textbox', { name: 'Add title' } )
			.fill( 'E2E source post' );
		const heading = await insertHeading( page, 'Styled hero' );
		await expect( heading ).toBeVisible();

		await openSettingsSidebar( page );
		await openPanel( page, 'Save as variation' );
		await page.getByRole( 'textbox', { name: 'Name' } ).fill( VARIATION_NAME );
		await page.getByRole( 'button', { name: 'Save variation' } ).click();

		// The new post has unsaved changes → the dirty-post confirm appears.
		await page
			.getByRole( 'button', { name: 'Save page and variation' } )
			.click();

		// Playground's WASM PHP serves the create POST in ~10s — be generous.
		await expect(
			page.locator( '.components-snackbar' ).filter( {
				hasText: `Variation "${ VARIATION_NAME }" created.`,
			} )
		).toBeVisible( { timeout: 60_000 } );

		// The panel flips to the linked state: the Apply select now carries
		// the new variation and an Edit source button appears.
		await expect(
			page.getByRole( 'button', { name: 'Edit source' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'combobox', { name: 'Apply' } )
		).toHaveValue( /^[1-9]\d*$/ );
	} );

	test( 'apply the variation to a fresh block', async ( { page } ) => {
		await openNewPost( page );
		await canvas( page )
			.getByRole( 'textbox', { name: 'Add title' } )
			.fill( 'E2E instance post' );
		const heading = await insertHeading( page, 'Plain heading' );
		await expect( heading ).toBeVisible();

		await openSettingsSidebar( page );
		await openPanel( page, 'Variation source' );
		const apply = page.getByRole( 'combobox', { name: 'Apply' } );
		await apply.selectOption( { label: VARIATION_NAME } );

		await expect(
			page.locator( '.components-snackbar' ).filter( {
				hasText: `Applied variation: ${ VARIATION_NAME }`,
			} )
		).toBeVisible( { timeout: 60_000 } );
		// Linked state proven by the panel, i.e. bvmVariationId > 0.
		await expect( apply ).toHaveValue( /^[1-9]\d*$/ );
		await expect(
			page.getByRole( 'button', { name: 'Edit source' } )
		).toBeVisible();

		// Publish so the instance counts as usage.
		await page
			.getByRole( 'button', { name: 'Publish', exact: true } )
			.click();
		await page
			.getByRole( 'region', { name: 'Editor publish' } )
			.getByRole( 'button', { name: 'Publish', exact: true } )
			.click();
		await expect(
			page.getByRole( 'region', { name: 'Editor publish' } )
				.getByText( 'is now live' )
		).toBeVisible( { timeout: 60_000 } );
	} );

	test( 'variation appears in the Tools listing with usage', async ( { page } ) => {
		await page.goto( '/wp-admin/edit.php?post_type=bvm_variation' );
		const row = page.getByRole( 'row' ).filter( { hasText: VARIATION_NAME } );
		await expect( row ).toBeVisible();
		await expect( row ).toContainText( 'core/heading' );
		// Source post + applied instance.
		await expect( row.locator( 'td.bvm_usage.column-bvm_usage' ) ).toHaveText( /[1-9]/ );
	} );
} );
