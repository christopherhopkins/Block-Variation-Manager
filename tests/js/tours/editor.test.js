/**
 * Editor tours (source/tours/editor.js) — Variation panel tour definition,
 * manual launch, and DOM-gated auto-start. Tour state is mocked.
 */
jest.mock( '../../../source/tours/state.js', () => ( {
	initTourState: jest.fn(),
	autoStartTour: jest.fn( () => true ),
	launchTour: jest.fn( () => true ),
} ) );

import {
	autoStartTour,
	launchTour,
} from '../../../source/tours/state.js';
import {
	EDITOR_TOUR_ID,
	editorTourSteps,
	startEditorTour,
	maybeAutoStartEditorTour,
} from '../../../source/tours/editor.js';

describe( 'editorTourSteps', () => {
	it( 'opens with a centered welcome step', () => {
		const steps = editorTourSteps();
		expect( steps[ 0 ].element ).toBeUndefined();
		expect( steps[ 0 ].title ).toBeTruthy();
	} );

	it( 'anchors save, apply, overrides and detach to the panels', () => {
		const anchors = editorTourSteps().map( ( s ) => s.element );
		expect( anchors ).toEqual(
			expect.arrayContaining( [
				'.bvm-save-variation-panel',
				'.bvm-variation-source-panel',
			] )
		);
	} );

	it( 'gives every step a title and description', () => {
		for ( const step of editorTourSteps() ) {
			expect( step.title ).toBeTruthy();
			expect( step.description ).toBeTruthy();
		}
	} );
} );

describe( 'startEditorTour', () => {
	beforeEach( () => jest.clearAllMocks() );

	it( 'launches regardless of DOM or completion state', () => {
		document.body.innerHTML = '';
		expect( startEditorTour() ).toBe( true );
		expect( launchTour ).toHaveBeenCalledWith( {
			id: EDITOR_TOUR_ID,
			steps: expect.any( Array ),
		} );
	} );
} );

describe( 'maybeAutoStartEditorTour', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		document.body.innerHTML = '';
	} );

	it( 'does not auto-start while the panel is not in the DOM', () => {
		expect( maybeAutoStartEditorTour() ).toBe( false );
		expect( autoStartTour ).not.toHaveBeenCalled();
	} );

	it( 'auto-starts once the Variation panel is visible', () => {
		document.body.innerHTML =
			'<div class="bvm-variation-source-panel"></div>';
		expect( maybeAutoStartEditorTour() ).toBe( true );
		expect( autoStartTour ).toHaveBeenCalledWith( {
			id: EDITOR_TOUR_ID,
			steps: expect.any( Array ),
		} );
	} );
} );

import {
	VARIATION_EDITOR_TOUR_ID,
	variationEditorTourSteps,
	startVariationEditorTour,
	maybeAutoStartVariationEditorTour,
} from '../../../source/tours/editor.js';

describe( 'variationEditorTourSteps', () => {
	it( 'anchors the name field and the usage panel', () => {
		const anchors = variationEditorTourSteps().map( ( s ) => s.element );
		expect( anchors ).toEqual(
			expect.arrayContaining( [
				'.editor-post-title',
				'.bvm-usage-panel',
			] )
		);
	} );

	it( 'gives every step a title and description', () => {
		for ( const step of variationEditorTourSteps() ) {
			expect( step.title ).toBeTruthy();
			expect( step.description ).toBeTruthy();
		}
	} );
} );

describe( 'startVariationEditorTour', () => {
	beforeEach( () => jest.clearAllMocks() );

	it( 'launches with the variation-editor tour id', () => {
		expect( startVariationEditorTour() ).toBe( true );
		expect( launchTour ).toHaveBeenCalledWith( {
			id: VARIATION_EDITOR_TOUR_ID,
			steps: expect.any( Array ),
		} );
	} );
} );

describe( 'maybeAutoStartVariationEditorTour', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		document.body.innerHTML = '';
		delete window.BVM;
	} );

	it( 'does not auto-start outside the variation editor', () => {
		window.BVM = { isVariationEditor: false };
		document.body.innerHTML = '<div class="bvm-usage-panel"></div>';
		expect( maybeAutoStartVariationEditorTour() ).toBe( false );
		expect( autoStartTour ).not.toHaveBeenCalled();
	} );

	it( 'does not auto-start before the usage panel renders', () => {
		window.BVM = { isVariationEditor: true };
		expect( maybeAutoStartVariationEditorTour() ).toBe( false );
		expect( autoStartTour ).not.toHaveBeenCalled();
	} );

	it( 'auto-starts on the variation editor once the panel is visible', () => {
		window.BVM = { isVariationEditor: true };
		document.body.innerHTML = '<div class="bvm-usage-panel"></div>';
		expect( maybeAutoStartVariationEditorTour() ).toBe( true );
		expect( autoStartTour ).toHaveBeenCalledWith( {
			id: VARIATION_EDITOR_TOUR_ID,
			steps: expect.any( Array ),
		} );
	} );
} );
