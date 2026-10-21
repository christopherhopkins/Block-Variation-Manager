import { dispatch } from '@wordpress/data';
import {
	ORIENTATION_STORAGE_KEY,
	dispatchOrientationNotice,
} from '../../../source/admin/orientation.js';

describe( 'dispatchOrientationNotice', () => {
	let createNotice;
	let removeNotice;

	beforeEach( () => {
		window.localStorage.clear();
		createNotice = jest.fn();
		removeNotice = jest.fn();
		dispatch.mockReset();
		dispatch.mockReturnValue( { createNotice, removeNotice } );
	} );

	it( 'creates a dismissible info notice with the usage count', () => {
		dispatchOrientationNotice( 3 );
		expect( dispatch ).toHaveBeenCalledWith( 'core/notices' );
		expect( removeNotice ).toHaveBeenCalledWith( 'bvm-orientation' );
		expect( createNotice ).toHaveBeenCalledWith(
			'info',
			expect.stringContaining( 'Used on 3 pages.' ),
			expect.objectContaining( {
				id: 'bvm-orientation',
				isDismissible: true,
				onDismiss: expect.any( Function ),
			} )
		);
	} );

	it( 'uses singular copy for one page and a fallback for zero', () => {
		dispatchOrientationNotice( 1 );
		expect( createNotice ).toHaveBeenLastCalledWith(
			'info',
			expect.stringContaining( 'Used on 1 page.' ),
			expect.any( Object )
		);
		dispatchOrientationNotice( 0 );
		expect( createNotice ).toHaveBeenLastCalledWith(
			'info',
			expect.stringContaining( 'Not used yet.' ),
			expect.any( Object )
		);
	} );

	it( 'persists dismissal and suppresses future notices', () => {
		dispatchOrientationNotice( 2 );
		const { onDismiss } = createNotice.mock.calls[ 0 ][ 2 ];
		onDismiss();
		expect(
			window.localStorage.getItem( ORIENTATION_STORAGE_KEY )
		).toBe( '1' );

		createNotice.mockClear();
		removeNotice.mockClear();
		dispatchOrientationNotice( 2 );
		// Still clears any prior copy, but creates nothing new.
		expect( removeNotice ).toHaveBeenCalledWith( 'bvm-orientation' );
		expect( createNotice ).not.toHaveBeenCalled();
	} );

	it( 'bails silently when the notices store is unavailable', () => {
		dispatch.mockReturnValue( undefined );
		expect( () => dispatchOrientationNotice( 1 ) ).not.toThrow();
	} );
} );
