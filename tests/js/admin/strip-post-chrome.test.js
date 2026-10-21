import { dispatch } from '@wordpress/data';
import { applyVariationEditorChrome } from '../../../source/admin/strip-post-chrome.js';

const PANELS = [
	'post-status',
	'post-link',
	'discussion-panel',
	'template',
	'page-attributes',
	'post-excerpt',
	'featured-image',
];

describe( 'applyVariationEditorChrome', () => {
	beforeEach( () => {
		document.body.innerHTML = '';
		document.body.className = '';
		delete window.BVM;
		dispatch.mockReset();
	} );

	it( 'adds the scoping body class', () => {
		dispatch.mockReturnValue( {} );
		applyVariationEditorChrome();
		expect(
			document.body.classList.contains( 'is-bvm-variation-editor' )
		).toBe( true );
	} );

	it( 'removes the inapplicable document panels via core/editor', () => {
		const removeEditorPanel = jest.fn();
		dispatch.mockImplementation( ( store ) =>
			store === 'core/editor' ? { removeEditorPanel } : {}
		);
		applyVariationEditorChrome();
		expect( removeEditorPanel.mock.calls.map( ( c ) => c[ 0 ] ) ).toEqual(
			PANELS
		);
	} );

	it( 'falls back to core/edit-post on older builds', () => {
		const removeEditorPanel = jest.fn();
		dispatch.mockImplementation( ( store ) =>
			store === 'core/edit-post' ? { removeEditorPanel } : {}
		);
		applyVariationEditorChrome();
		expect( removeEditorPanel ).toHaveBeenCalledTimes( PANELS.length );
	} );

	it( 'retargets an existing back-link anchor at the variations list', () => {
		dispatch.mockReturnValue( {} );
		window.BVM = { variationListUrl: '/wp-admin/tools.php?page=bvm' };
		document.body.innerHTML =
			'<a class="edit-post-fullscreen-mode-close" href="/wp-admin/"></a>';
		applyVariationEditorChrome();
		const el = document.querySelector( '.edit-post-fullscreen-mode-close' );
		expect( el.getAttribute( 'href' ) ).toBe(
			'/wp-admin/tools.php?page=bvm'
		);
		expect( el.getAttribute( 'aria-label' ) ).toBe( 'Block Variations' );
	} );

	it( 'leaves a <button> back affordance alone', () => {
		dispatch.mockReturnValue( {} );
		window.BVM = { variationListUrl: '/x' };
		document.body.innerHTML =
			'<button class="editor-document-tools__back"></button>';
		applyVariationEditorChrome();
		const el = document.querySelector( '.editor-document-tools__back' );
		expect( el.getAttribute( 'href' ) ).toBeNull();
	} );

	it( 'waits for a late-mounted back link via MutationObserver', async () => {
		dispatch.mockReturnValue( {} );
		window.BVM = { variationListUrl: '/list' };
		applyVariationEditorChrome();

		const a = document.createElement( 'a' );
		a.className = 'editor-document-tools__back';
		document.body.appendChild( a );

		// MutationObserver callbacks are microtask-scheduled in jsdom.
		await new Promise( ( r ) => setTimeout( r, 0 ) );
		expect( a.getAttribute( 'href' ) ).toBe( '/list' );
	} );

	it( 'does nothing without a configured list URL', () => {
		dispatch.mockReturnValue( {} );
		document.body.innerHTML =
			'<a class="editor-document-tools__back" href="/wp-admin/"></a>';
		applyVariationEditorChrome();
		expect(
			document
				.querySelector( '.editor-document-tools__back' )
				.getAttribute( 'href' )
		).toBe( '/wp-admin/' );
	} );
} );
