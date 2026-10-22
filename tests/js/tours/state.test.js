/**
 * Tour completion state (source/tours/state.js) — seeded from localized
 * data, optimistic local cache, persisted through core /wp/v2/users/me.
 */
import apiFetch from '@wordpress/api-fetch';

jest.mock( '../../../source/tours/engine.js', () => ( {
	startTour: jest.fn( () => true ),
} ) );

import { startTour } from '../../../source/tours/engine.js';
import {
	TOURS_META_KEY,
	initTourState,
	hasCompleted,
	markCompleted,
	launchTour,
	autoStartTour,
} from '../../../source/tours/state.js';

describe( 'tour state', () => {
	beforeEach( () => {
		apiFetch.mockClear();
		apiFetch.mockImplementation( () => Promise.resolve( {} ) );
		startTour.mockClear();
		startTour.mockImplementation( () => true );
		initTourState( { seeded: true } );
	} );

	it( 'exposes the PHP meta key', () => {
		expect( TOURS_META_KEY ).toBe( 'bvm_tours_completed' );
	} );

	it( 'reads completion from the seed', () => {
		expect( hasCompleted( 'seeded' ) ).toBe( true );
		expect( hasCompleted( 'unseen' ) ).toBe( false );
	} );

	it( 'tolerates a missing seed', () => {
		initTourState( undefined );
		expect( hasCompleted( 'anything' ) ).toBe( false );
	} );

	describe( 'markCompleted', () => {
		it( 'is optimistic and persists the full map to users/me', async () => {
			await markCompleted( 'management' );
			expect( hasCompleted( 'management' ) ).toBe( true );
			expect( apiFetch ).toHaveBeenCalledWith( {
				path: '/wp/v2/users/me',
				method: 'POST',
				data: {
					meta: {
						[ TOURS_META_KEY ]: {
							seeded: true,
							management: true,
						},
					},
				},
			} );
		} );

		it( 'keeps the local flag and stays quiet when persistence fails', async () => {
			apiFetch.mockImplementation( () =>
				Promise.reject( new Error( 'offline' ) )
			);
			await expect(
				markCompleted( 'management' )
			).resolves.toBeUndefined();
			expect( hasCompleted( 'management' ) ).toBe( true );
		} );

		it( 'does not re-persist an already-completed tour', async () => {
			await markCompleted( 'seeded' );
			expect( apiFetch ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'launchTour', () => {
		it( 'starts the tour and marks it completed on finish', () => {
			const steps = [ { title: 't', description: 'd' } ];
			expect( launchTour( { id: 'management', steps } ) ).toBe( true );
			expect( startTour ).toHaveBeenCalledWith(
				expect.objectContaining( {
					steps,
					onFinish: expect.any( Function ),
				} )
			);
			startTour.mock.calls[ 0 ][ 0 ].onFinish();
			expect( hasCompleted( 'management' ) ).toBe( true );
		} );

		it( 'relaunches even when already completed', () => {
			expect(
				launchTour( { id: 'seeded', steps: [] } )
			).toBe( true );
			expect( startTour ).toHaveBeenCalledTimes( 1 );
		} );
	} );

	describe( 'autoStartTour', () => {
		it( 'starts only when the tour has not been completed', () => {
			expect(
				autoStartTour( { id: 'unseen', steps: [] } )
			).toBe( true );
			expect( startTour ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'never auto-starts a completed tour', () => {
			expect(
				autoStartTour( { id: 'seeded', steps: [] } )
			).toBe( false );
			expect( startTour ).not.toHaveBeenCalled();
		} );

		it( 'does not mark completion when nothing was shown', () => {
			startTour.mockImplementation( () => false );
			expect(
				autoStartTour( { id: 'unseen', steps: [] } )
			).toBe( false );
			expect( hasCompleted( 'unseen' ) ).toBe( false );
		} );
	} );
} );
