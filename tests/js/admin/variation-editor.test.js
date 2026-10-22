jest.mock( '../../../source/admin/orientation.js', () => ( {
	dispatchOrientationNotice: jest.fn(),
} ) );
jest.mock( '../../../source/admin/strip-post-chrome.js', () => ( {
	applyVariationEditorChrome: jest.fn(),
} ) );
jest.mock( '../../../source/admin/usage-panel.js', () => ( {} ) );
jest.mock( '../../../source/lib/variation-store.js', () => ( {
	updateVariation: jest.fn( () => Promise.resolve( {} ) ),
} ) );

/**
 * The module boots itself from window.BVM on import, so each test loads it
 * fresh inside an isolated registry. Everything it talks to (the @wordpress/*
 * stubs and the mocked local modules) is re-instantiated inside that registry,
 * so capture the references from within the isolation.
 */
function boot( ctx ) {
	window.BVM = ctx;
	let data;
	let blocks;
	let chrome;
	let orientation;
	let store;
	jest.isolateModules( () => {
		data = require( '@wordpress/data' );
		blocks = require( '@wordpress/blocks' );
		chrome = require( '../../../source/admin/strip-post-chrome.js' );
		orientation = require( '../../../source/admin/orientation.js' );
		store = require( '../../../source/lib/variation-store.js' );
		require( '../../../source/admin/variation-editor.js' );
	} );
	return {
		data,
		blocks,
		chrome,
		orientation,
		store,
		enforce: data.subscribe.mock.calls[ 0 ]?.[ 0 ],
		saveSync: data.subscribe.mock.calls[ 1 ]?.[ 0 ],
	};
}

/** Wire the select stub to the given store implementations. */
function mockStores( data, { blockEditor = {}, editor = {} } = {} ) {
	data.select.mockImplementation( ( store ) => {
		if ( store === 'core/block-editor' ) return blockEditor;
		if ( store === 'core/editor' ) return editor;
		return {};
	} );
}

afterEach( () => {
	delete window.BVM;
} );

describe( 'variation-editor boot', () => {
	it( 'does nothing outside the variation editor', () => {
		const { enforce, saveSync, chrome } = boot( {} );
		expect( enforce ).toBeUndefined();
		expect( saveSync ).toBeUndefined();
		expect( chrome.applyVariationEditorChrome ).not.toHaveBeenCalled();
	} );

	it( 'applies chrome, subscribes, and fires the orientation notice', () => {
		const { data, chrome, orientation } = boot( {
			isVariationEditor: true,
			variationBlockType: 'core/heading',
			variationUsageCount: 4,
		} );
		expect( chrome.applyVariationEditorChrome ).toHaveBeenCalled();
		expect( data.subscribe ).toHaveBeenCalledTimes( 2 );
		expect( orientation.dispatchOrientationNotice ).toHaveBeenCalledWith(
			4
		);
	} );

	describe( 'root-block enforcement', () => {
		const CTX = {
			isVariationEditor: true,
			variationBlockType: 'core/heading',
		};

		it( 'seeds an empty editor with the block type', () => {
			const { data, enforce } = boot( CTX );
			const resetBlocks = jest.fn();
			data.dispatch.mockReturnValue( { resetBlocks } );
			mockStores( data, { blockEditor: { getBlocks: () => [] } } );
			enforce();
			expect( resetBlocks ).toHaveBeenCalledTimes( 1 );
			const seeded = resetBlocks.mock.calls[ 0 ][ 0 ];
			expect( seeded ).toHaveLength( 1 );
			expect( seeded[ 0 ].name ).toBe( 'core/heading' );
		} );

		it( 'seeds the wrapper chain for child-only block types', () => {
			const { data, enforce } = boot( {
				isVariationEditor: true,
				variationBlockType: 'core/list-item',
				variationRootChain: [ 'core/list', 'core/list-item' ],
			} );
			const resetBlocks = jest.fn();
			data.dispatch.mockReturnValue( { resetBlocks } );
			mockStores( data, { blockEditor: { getBlocks: () => [] } } );
			enforce();
			const seeded = resetBlocks.mock.calls[ 0 ][ 0 ];
			expect( seeded[ 0 ].name ).toBe( 'core/list' );
			expect( seeded[ 0 ].innerBlocks[ 0 ].name ).toBe(
				'core/list-item'
			);
		} );

		it( 'waits for the editor to be ready before enforcing', () => {
			const { data, enforce } = boot( CTX );
			const resetBlocks = jest.fn();
			data.dispatch.mockReturnValue( { resetBlocks } );
			mockStores( data, {
				blockEditor: { getBlocks: () => [] },
				editor: { __unstableIsEditorReady: () => false },
			} );
			enforce();
			expect( resetBlocks ).not.toHaveBeenCalled();
		} );

		it( 'replaces a wrong-type root with a fresh seed', () => {
			const { data, enforce } = boot( CTX );
			const resetBlocks = jest.fn();
			data.dispatch.mockReturnValue( { resetBlocks } );
			mockStores( data, {
				blockEditor: {
					getBlocks: () => [
						{ name: 'core/paragraph', innerBlocks: [] },
					],
				},
			} );
			enforce();
			const kept = resetBlocks.mock.calls[ 0 ][ 0 ];
			expect( kept[ 0 ].name ).toBe( 'core/heading' );
		} );

		it( 'drops stray extra roots, keeping the first', () => {
			const { data, enforce } = boot( CTX );
			const resetBlocks = jest.fn();
			data.dispatch.mockReturnValue( { resetBlocks } );
			const first = {
				name: 'core/heading',
				innerBlocks: [ { name: 'core/paragraph', innerBlocks: [] } ],
			};
			mockStores( data, {
				blockEditor: {
					getBlocks: () => [
						first,
						{ name: 'core/paragraph', innerBlocks: [] },
					],
				},
			} );
			enforce();
			expect( resetBlocks ).toHaveBeenCalledWith( [ first ] );
		} );

		it( 'leaves everything alone when the chain is unregistered (COR-10)', () => {
			const { data, blocks, enforce } = boot( CTX );
			// The variation's plugin is deactivated: the root type no longer
			// exists, so enforcement must bail instead of createBlock-throwing
			// inside the data subscriber.
			blocks.getBlockType.mockReturnValue( undefined );
			const resetBlocks = jest.fn();
			data.dispatch.mockReturnValue( { resetBlocks } );
			mockStores( data, { blockEditor: { getBlocks: () => [] } } );
			expect( () => enforce() ).not.toThrow();
			expect( resetBlocks ).not.toHaveBeenCalled();
			expect( blocks.createBlock ).not.toHaveBeenCalled();
		} );

		it( 'leaves a single correct root alone', () => {
			const { data, enforce } = boot( CTX );
			const resetBlocks = jest.fn();
			data.dispatch.mockReturnValue( { resetBlocks } );
			mockStores( data, {
				blockEditor: {
					getBlocks: () => [
						{ name: 'core/heading', innerBlocks: [] },
					],
				},
			} );
			enforce();
			expect( resetBlocks ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'attrs save sync', () => {
		const CTX = {
			isVariationEditor: true,
			variationBlockType: 'core/heading',
		};

		function editorState( { saving, success = true, postId = 9 } ) {
			return {
				isSavingPost: () => saving,
				isAutosavingPost: () => false,
				didPostSaveRequestSucceed: () => success,
				getCurrentPostId: () => postId,
			};
		}

		it( 'PUTs resolved attrs and inner tree after a successful save', () => {
			const { data, saveSync, store } = boot( CTX );
			data.dispatch.mockReturnValue( {} );
			const blocks = [
				{
					// Source block nested under a wrapper — recursion required.
					name: 'core/group',
					attributes: {},
					innerBlocks: [
						{
							name: 'core/heading',
							attributes: {
								level: 2,
								uniqueID: 'drop-me',
								content: 'Hello',
							},
							innerBlocks: [
								{
									name: 'core/paragraph',
									attributes: { content: 'child' },
									innerBlocks: [],
								},
							],
						},
					],
				},
			];
			mockStores( data, {
				editor: editorState( { saving: true } ),
				blockEditor: { getBlocks: () => blocks },
			} );
			saveSync(); // enters saving
			mockStores( data, {
				editor: editorState( { saving: false } ),
				blockEditor: { getBlocks: () => blocks },
			} );
			saveSync(); // leaves saving → sync fires

			expect( store.updateVariation ).toHaveBeenCalledWith( 9, {
				attrs: { level: 2, content: 'Hello' },
				innerBlocks: [
					{
						name: 'core/paragraph',
						attributes: { content: 'child' },
						innerBlocks: [],
					},
				],
			} );
		} );

		it( 'does not sync on failed saves', () => {
			const { data, saveSync, store } = boot( CTX );
			mockStores( data, { editor: editorState( { saving: true } ) } );
			saveSync();
			mockStores( data, {
				editor: editorState( { saving: false, success: false } ),
			} );
			saveSync();
			expect( store.updateVariation ).not.toHaveBeenCalled();
		} );

		it( 'does not sync without a save-finish transition', () => {
			const { data, saveSync, store } = boot( CTX );
			mockStores( data, { editor: editorState( { saving: false } ) } );
			saveSync();
			saveSync();
			expect( store.updateVariation ).not.toHaveBeenCalled();
		} );

		it( 'does nothing when the source block is missing', () => {
			const { data, saveSync, store } = boot( CTX );
			mockStores( data, {
				editor: editorState( { saving: true } ),
				blockEditor: { getBlocks: () => [] },
			} );
			saveSync();
			mockStores( data, {
				editor: editorState( { saving: false } ),
				blockEditor: { getBlocks: () => [] },
			} );
			saveSync();
			expect( store.updateVariation ).not.toHaveBeenCalled();
		} );
	} );
} );
