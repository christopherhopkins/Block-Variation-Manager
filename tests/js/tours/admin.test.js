/**
 * Management-screen tour (source/tours/admin.js) — "Start tour" button and
 * auto-start wiring on Tools → Block Variations. Tour state is mocked; these
 * tests pin the mount/gating contract and the step anchors.
 */
jest.mock( '../../../source/tours/state.js', () => ( {
	initTourState: jest.fn(),
	autoStartTour: jest.fn( () => false ),
	launchTour: jest.fn( () => true ),
} ) );

import {
	initTourState,
	autoStartTour,
	launchTour,
} from '../../../source/tours/state.js';
import {
	MANAGEMENT_TOUR_ID,
	managementTourSteps,
	initManagementTour,
} from '../../../source/tours/admin.js';

function mountListScreen() {
	document.body.innerHTML = `
		<div class="wrap">
			<h1 class="wp-heading-inline">Block Variations</h1>
			<a href="#" class="page-title-action">Add Variation</a>
			<hr class="wp-header-end" />
			<table class="wp-list-table">
				<thead>
					<tr>
						<th class="manage-column column-bvm_block_type">Block</th>
						<th class="manage-column column-bvm_usage">Pages</th>
					</tr>
				</thead>
				<tbody id="the-list"></tbody>
			</table>
		</div>`;
}

describe( 'managementTourSteps', () => {
	it( 'opens with a centered welcome step', () => {
		const steps = managementTourSteps();
		expect( steps[ 0 ].element ).toBeUndefined();
		expect( steps[ 0 ].title ).toEqual( expect.any( String ) );
		expect( steps[ 0 ].description ).toEqual( expect.any( String ) );
	} );

	it( 'anchors steps to the list-screen landmarks', () => {
		const anchors = managementTourSteps().map( ( s ) => s.element );
		expect( anchors ).toEqual(
			expect.arrayContaining( [
				'.wp-list-table',
				'.manage-column.column-bvm_block_type',
				'.manage-column.column-bvm_usage',
				'.page-title-action',
			] )
		);
	} );

	it( 'gives every step a title and description', () => {
		for ( const step of managementTourSteps() ) {
			expect( step.title ).toBeTruthy();
			expect( step.description ).toBeTruthy();
		}
	} );
} );

describe( 'initManagementTour', () => {
	beforeEach( () => {
		initTourState.mockClear();
		autoStartTour.mockClear();
		launchTour.mockClear();
		window.BVMTours = { completed: { management: true } };
	} );

	afterEach( () => {
		delete window.BVMTours;
		document.body.innerHTML = '';
	} );

	it( 'does nothing off the variations list screen', () => {
		document.body.innerHTML = '<div class="wrap"></div>';
		expect( initManagementTour() ).toBe( false );
		expect( autoStartTour ).not.toHaveBeenCalled();
	} );

	it( 'seeds state, mounts the button, and auto-starts once', () => {
		mountListScreen();
		expect( initManagementTour() ).toBe( true );

		expect( initTourState ).toHaveBeenCalledWith( {
			management: true,
		} );

		const button = document.querySelector( 'button.bvm-tour-start' );
		expect( button ).not.toBeNull();
		expect( button.type ).toBe( 'button' );
		expect( button.className ).toContain( 'page-title-action' );
		expect( button.textContent ).toBe( 'Start tour' );

		expect( autoStartTour ).toHaveBeenCalledTimes( 1 );
		expect( autoStartTour ).toHaveBeenCalledWith( {
			id: MANAGEMENT_TOUR_ID,
			steps: expect.any( Array ),
		} );
	} );

	it( 'relaunches via the button regardless of completion', () => {
		mountListScreen();
		initManagementTour();
		document.querySelector( 'button.bvm-tour-start' ).click();
		expect( launchTour ).toHaveBeenCalledWith( {
			id: MANAGEMENT_TOUR_ID,
			steps: expect.any( Array ),
		} );
	} );

	it( 'does not mount twice', () => {
		mountListScreen();
		initManagementTour();
		initManagementTour();
		expect(
			document.querySelectorAll( 'button.bvm-tour-start' )
		).toHaveLength( 1 );
	} );

	it( 'tolerates a missing localized seed', () => {
		delete window.BVMTours;
		mountListScreen();
		expect( initManagementTour() ).toBe( true );
		expect( initTourState ).toHaveBeenCalledWith( undefined );
	} );
} );
