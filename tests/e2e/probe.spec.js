import { test, expect } from '@playwright/test';

test( 'probe: wp-admin reachable and logged in', async ( { page } ) => {
	await page.goto( '/wp-admin/' );
	await expect( page.locator( '#wpadminbar' ) ).toBeVisible();
} );
