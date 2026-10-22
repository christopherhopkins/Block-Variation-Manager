import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { registerPlugin } from '@wordpress/plugins';
import { useSelect } from '@wordpress/data';

jest.mock( '../../../source/lib/variation-store.js', () => ( {
	listInstances: jest.fn(),
} ) );
jest.mock( '../../../source/admin/orientation.js', () => ( {
	ORIENTATION_STORAGE_KEY: 'bvm-orientation-seen',
	dispatchOrientationNotice: jest.fn(),
} ) );
jest.mock( '../../../source/tours/editor.js', () => ( {
	startVariationEditorTour: jest.fn( () => true ),
	maybeAutoStartVariationEditorTour: jest.fn( () => false ),
} ) );

const { listInstances } = require( '../../../source/lib/variation-store.js' );
const {
	dispatchOrientationNotice,
} = require( '../../../source/admin/orientation.js' );
const toursMock = require( '../../../source/tours/editor.js' );

require( '../../../source/admin/usage-panel.js' );

const UsagePanel = registerPlugin.mock.calls.find(
	( c ) => c[ 0 ] === 'bvm-usage'
)[ 1 ].render;

function mockEditorState( { postId, postType } ) {
	useSelect.mockImplementation( ( cb ) =>
		cb( ( store ) =>
			store === 'core/editor'
				? {
						getCurrentPostId: () => postId,
						getCurrentPostType: () => postType,
				  }
				: {}
		)
	);
}

describe( 'UsagePanel', () => {
	beforeEach( () => {
		listInstances.mockReset();
		dispatchOrientationNotice.mockClear();
		window.localStorage.clear();
		delete window.BVM;
	} );

	it( 'registers as an editor plugin', () => {
		expect( registerPlugin ).toHaveBeenCalledWith( 'bvm-usage', {
			render: expect.any( Function ),
		} );
	} );

	it( 'renders nothing outside the variation CPT', () => {
		mockEditorState( { postId: 1, postType: 'post' } );
		const { container } = render( <UsagePanel /> );
		expect( container.innerHTML ).toBe( '' );
		expect( listInstances ).not.toHaveBeenCalled();
	} );

	it( 'shows a spinner while loading, then the instance list', async () => {
		mockEditorState( { postId: 42, postType: 'bvm_variation' } );
		listInstances.mockResolvedValue( [
			{
				id: 1,
				title: 'Home',
				edit_link: '/edit1',
				post_type: 'page',
				status: 'publish',
			},
			{
				id: 2,
				title: 'Draft news',
				edit_link: '/edit2',
				post_type: 'post',
				status: 'draft',
			},
		] );
		render( <UsagePanel /> );
		expect( screen.getByTestId( 'spinner' ) ).toBeTruthy();
		expect( listInstances ).toHaveBeenCalledWith( 42 );

		await waitFor( () =>
			expect( screen.getByText( 'Used on 2 pages' ) ).toBeTruthy()
		);
		expect( screen.getByText( 'Home' ).getAttribute( 'href' ) ).toBe(
			'/edit1'
		);
		// Non-publish status is surfaced next to the post type.
		expect( screen.getByText( /post · draft/ ) ).toBeTruthy();
	} );

	it( 'shows the empty state', async () => {
		mockEditorState( { postId: 42, postType: 'bvm_variation' } );
		listInstances.mockResolvedValue( [] );
		render( <UsagePanel /> );
		await waitFor( () =>
			expect(
				screen.getByText( 'Not used on any pages yet.' )
			).toBeTruthy()
		);
	} );

	it( 'surfaces fetch errors', async () => {
		mockEditorState( { postId: 42, postType: 'bvm_variation' } );
		listInstances.mockRejectedValue( new Error( 'REST down' ) );
		render( <UsagePanel /> );
		await waitFor( () =>
			expect( screen.getByText( 'REST down' ) ).toBeTruthy()
		);
	} );

	it( 're-fires the orientation banner and clears the dismissal', async () => {
		mockEditorState( { postId: 42, postType: 'bvm_variation' } );
		listInstances.mockResolvedValue( [] );
		window.localStorage.setItem( 'bvm-orientation-seen', '1' );
		window.BVM = { variationUsageCount: 5 };
		render( <UsagePanel /> );
		await waitFor( () =>
			expect(
				screen.getByText( 'Show orientation banner' )
			).toBeTruthy()
		);
		fireEvent.click( screen.getByText( 'Show orientation banner' ) );
		expect(
			window.localStorage.getItem( 'bvm-orientation-seen' )
		).toBeNull();
		expect( dispatchOrientationNotice ).toHaveBeenCalledWith( 5 );
	} );
} );

describe( 'UsagePanel tour integration', () => {
	beforeEach( () => {
		toursMock.startVariationEditorTour.mockClear();
		toursMock.maybeAutoStartVariationEditorTour.mockClear();
	} );

	it( 'renders a Take the tour link that relaunches the tour', async () => {
		mockEditorState( { postId: 42, postType: 'bvm_variation' } );
		listInstances.mockResolvedValue( [] );
		render( <UsagePanel /> );
		await waitFor( () =>
			expect( screen.getByText( 'Take the tour' ) ).toBeTruthy()
		);
		fireEvent.click( screen.getByText( 'Take the tour' ) );
		expect( toursMock.startVariationEditorTour ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'schedules a one-shot auto-start after mount', async () => {
		jest.useFakeTimers();
		try {
			mockEditorState( { postId: 42, postType: 'bvm_variation' } );
			listInstances.mockResolvedValue( [] );
			render( <UsagePanel /> );
			expect(
				toursMock.maybeAutoStartVariationEditorTour
			).not.toHaveBeenCalled();
			await act( async () => {
				jest.advanceTimersByTime( 1000 );
			} );
			expect(
				toursMock.maybeAutoStartVariationEditorTour
			).toHaveBeenCalledTimes( 1 );
		} finally {
			jest.useRealTimers();
		}
	} );

	it( 'never schedules the tour outside the variation CPT', async () => {
		jest.useFakeTimers();
		try {
			mockEditorState( { postId: 1, postType: 'post' } );
			render( <UsagePanel /> );
			await act( async () => {
				jest.advanceTimersByTime( 1000 );
			} );
			expect(
				toursMock.maybeAutoStartVariationEditorTour
			).not.toHaveBeenCalled();
		} finally {
			jest.useRealTimers();
		}
	} );
} );
