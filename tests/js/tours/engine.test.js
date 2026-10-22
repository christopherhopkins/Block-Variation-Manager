/**
 * Tour engine wrapper (source/tours/engine.js) — declarative step lists in,
 * driver.js invocations out. driver.js itself is mocked: these tests pin the
 * invocation contract, not the library's behavior.
 */
jest.mock(
	'driver.js',
	() => ( {
		driver: jest.fn( () => ( {
			drive: jest.fn(),
			destroy: jest.fn(),
		} ) ),
	} ),
	{ virtual: true }
);

import { driver } from 'driver.js';
import {
	prefersReducedMotion,
	resolveSteps,
	createTour,
	startTour,
} from '../../../source/tours/engine.js';

function mockMatchMedia( reducedMotion ) {
	window.matchMedia = jest.fn( ( query ) => ( {
		matches:
			reducedMotion && query === '(prefers-reduced-motion: reduce)',
		media: query,
	} ) );
}

describe( 'resolveSteps', () => {
	beforeEach( () => {
		document.body.innerHTML = '<div id="present"></div>';
	} );

	it( 'maps declarative steps to driver popover steps', () => {
		const out = resolveSteps( [
			{ element: '#present', title: 'Here', description: 'A thing.' },
		] );
		expect( out ).toEqual( [
			{
				element: '#present',
				popover: { title: 'Here', description: 'A thing.' },
			},
		] );
	} );

	it( 'drops steps whose anchor is missing from the DOM', () => {
		const out = resolveSteps( [
			{ element: '#present', title: 'Keep', description: 'x' },
			{ element: '#absent', title: 'Drop', description: 'y' },
		] );
		expect( out ).toHaveLength( 1 );
		expect( out[ 0 ].popover.title ).toBe( 'Keep' );
	} );

	it( 'keeps element-less steps as centered modal steps', () => {
		const out = resolveSteps( [
			{ title: 'Welcome', description: 'Intro.' },
		] );
		expect( out ).toEqual( [
			{ popover: { title: 'Welcome', description: 'Intro.' } },
		] );
	} );
} );

describe( 'prefersReducedMotion', () => {
	it( 'reflects the media query', () => {
		mockMatchMedia( true );
		expect( prefersReducedMotion() ).toBe( true );
		mockMatchMedia( false );
		expect( prefersReducedMotion() ).toBe( false );
	} );

	it( 'is false when matchMedia is unavailable', () => {
		const orig = window.matchMedia;
		// eslint-disable-next-line no-undefined
		window.matchMedia = undefined;
		expect( prefersReducedMotion() ).toBe( false );
		window.matchMedia = orig;
	} );
} );

describe( 'createTour', () => {
	beforeEach( () => {
		driver.mockClear();
		document.body.innerHTML = '<div id="present"></div>';
		mockMatchMedia( false );
	} );

	it( 'returns null and never invokes driver.js when no steps resolve', () => {
		const tour = createTour( {
			steps: [ { element: '#absent', title: 'x', description: 'y' } ],
		} );
		expect( tour ).toBeNull();
		expect( driver ).not.toHaveBeenCalled();
	} );

	it( 'passes resolved steps and progress UI to driver.js', () => {
		createTour( {
			steps: [
				{ element: '#present', title: 'Here', description: 'A.' },
			],
		} );
		expect( driver ).toHaveBeenCalledWith(
			expect.objectContaining( {
				showProgress: true,
				animate: true,
				steps: [
					{
						element: '#present',
						popover: { title: 'Here', description: 'A.' },
					},
				],
			} )
		);
	} );

	it( 'disables animation under prefers-reduced-motion', () => {
		mockMatchMedia( true );
		createTour( {
			steps: [ { title: 'Welcome', description: 'Intro.' } ],
		} );
		expect( driver ).toHaveBeenCalledWith(
			expect.objectContaining( { animate: false } )
		);
	} );

	it( 'fires onFinish and destroys via onDestroyStarted (§9.21)', () => {
		const onFinish = jest.fn();
		createTour( {
			steps: [ { title: 'Welcome', description: 'Intro.' } ],
			onFinish,
		} );
		const config = driver.mock.calls[ 0 ][ 0 ];
		// onDestroyed is transition-gated in driver.js — an early dismissal
		// would skip it, so completion must NOT be wired through it.
		expect( config.onDestroyed ).toBeUndefined();
		expect( config.onDestroyStarted ).toEqual( expect.any( Function ) );

		const instance = { destroy: jest.fn() };
		config.onDestroyStarted( undefined, undefined, { driver: instance } );
		expect( onFinish ).toHaveBeenCalledTimes( 1 );
		expect( instance.destroy ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'startTour', () => {
	beforeEach( () => {
		driver.mockClear();
		document.body.innerHTML = '<div id="present"></div>';
		mockMatchMedia( false );
	} );

	it( 'drives the tour and reports true', () => {
		const drive = jest.fn();
		driver.mockReturnValueOnce( { drive, destroy: jest.fn() } );
		const started = startTour( {
			steps: [
				{ element: '#present', title: 'Here', description: 'A.' },
			],
		} );
		expect( started ).toBe( true );
		expect( drive ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'reports false when nothing can be shown', () => {
		const started = startTour( {
			steps: [ { element: '#absent', title: 'x', description: 'y' } ],
		} );
		expect( started ).toBe( false );
		expect( driver ).not.toHaveBeenCalled();
	} );
} );
