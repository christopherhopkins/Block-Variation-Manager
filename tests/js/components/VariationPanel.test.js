import {
	render,
	screen,
	waitFor,
	fireEvent,
	act,
} from '@testing-library/react';
import { dispatch, select } from '@wordpress/data';
import { createBlock, serialize } from '@wordpress/blocks';

jest.mock( '../../../source/lib/variation-store.js', () => ( {
	subscribe: jest.fn( () => () => {} ),
	getVersion: jest.fn( () => 0 ),
	getCached: jest.fn(),
	ensureVariationLoaded: jest.fn( () => Promise.resolve( null ) ),
	listForBlockType: jest.fn( () => Promise.resolve( [] ) ),
	createVariation: jest.fn(),
} ) );
jest.mock( '../../../source/lib/block-registry.js', () => ( {
	ensureRegistryLoaded: jest.fn( () => Promise.resolve( {} ) ),
	hasRequiredChildren: jest.fn( () => false ),
} ) );

const storeMock = require( '../../../source/lib/variation-store.js' );
const registryMock = require( '../../../source/lib/block-registry.js' );
const VariationPanel =
	require( '../../../source/components/VariationPanel.js' ).default;

const LIST = [
	{ id: 5, title: 'Brand hero' },
	{ id: 6, title: 'Muted hero' },
];

let notices;
let blockEditorDispatch;
let editorDispatch;

function wireDispatch() {
	notices = { createNotice: jest.fn() };
	blockEditorDispatch = { replaceInnerBlocks: jest.fn() };
	editorDispatch = { savePost: jest.fn( () => Promise.resolve() ) };
	dispatch.mockImplementation( ( store ) => {
		if ( store === 'core/notices' ) return notices;
		if ( store === 'core/block-editor' ) return blockEditorDispatch;
		if ( store === 'core/editor' ) return editorDispatch;
		return {};
	} );
}

function wireSelect( { children = [], isDirty = false } = {} ) {
	select.mockImplementation( ( store ) => {
		if ( store === 'core/block-editor' )
			return { getBlocks: jest.fn( () => children ) };
		if ( store === 'core/editor' )
			return { isEditedPostDirty: () => isDirty };
		return {};
	} );
}

function renderPanel( attributes = {}, props = {} ) {
	const setAttributes = jest.fn();
	const utils = render(
		<VariationPanel
			attributes={ attributes }
			setAttributes={ setAttributes }
			name="core/heading"
			clientId="c1"
			{ ...props }
		/>
	);
	return { setAttributes, ...utils };
}

beforeEach( () => {
	jest.clearAllMocks();
	storeMock.subscribe.mockImplementation( () => () => {} );
	storeMock.getVersion.mockReturnValue( 0 );
	storeMock.listForBlockType.mockResolvedValue( LIST );
	storeMock.ensureVariationLoaded.mockResolvedValue( null );
	registryMock.ensureRegistryLoaded.mockResolvedValue( {} );
	registryMock.hasRequiredChildren.mockReturnValue( false );
	wireDispatch();
	wireSelect();
	delete window.BVM;
} );

describe( 'SourcePanel', () => {
	it( 'lists variations for the block type in the Apply select', async () => {
		renderPanel();
		await waitFor( () =>
			expect( screen.getByText( 'Brand hero' ) ).toBeTruthy()
		);
		expect( storeMock.listForBlockType ).toHaveBeenCalledWith(
			'core/heading'
		);
		expect( screen.getByText( '— None —' ) ).toBeTruthy();
	} );

	it( 'surfaces list fetch errors', async () => {
		storeMock.listForBlockType.mockRejectedValue( new Error( 'nope' ) );
		renderPanel();
		await waitFor( () => expect( screen.getByText( 'nope' ) ).toBeTruthy() );
	} );

	it( 'warns when the linked variation no longer exists', async () => {
		storeMock.getCached.mockReturnValue( null ); // confirmed missing
		renderPanel( { bvmVariationId: 99 } );
		await waitFor( () =>
			expect(
				screen.getByText( /no longer exists/ )
			).toBeTruthy()
		);
	} );

	it( 'applies attrs-only when the variation has no inner blocks', async () => {
		storeMock.ensureVariationLoaded.mockResolvedValue( {
			id: 5,
			inner_blocks: [],
		} );
		const { setAttributes } = renderPanel();
		await waitFor( () =>
			expect( screen.getByText( 'Brand hero' ) ).toBeTruthy()
		);
		await act( async () => {
			fireEvent.change( screen.getByRole( 'combobox' ), {
				target: { value: '5' },
			} );
		} );
		expect( setAttributes ).toHaveBeenCalledWith( {
			bvmVariationId: 5,
			bvmOverriddenAttrs: [],
		} );
		expect(
			blockEditorDispatch.replaceInnerBlocks
		).not.toHaveBeenCalled();
		expect( notices.createNotice ).toHaveBeenCalledWith(
			'success',
			'Applied variation: Brand hero',
			expect.any( Object )
		);
	} );

	it( 'restores the template silently into an empty block', async () => {
		storeMock.ensureVariationLoaded.mockResolvedValue( {
			id: 5,
			inner_blocks: [ [ 'core/paragraph', { a: 1 }, [] ] ],
		} );
		wireSelect( { children: [] } );
		const { setAttributes } = renderPanel();
		await waitFor( () =>
			expect( screen.getByText( 'Brand hero' ) ).toBeTruthy()
		);
		await act( async () => {
			fireEvent.change( screen.getByRole( 'combobox' ), {
				target: { value: '5' },
			} );
		} );
		expect( setAttributes ).toHaveBeenCalledWith( {
			bvmVariationId: 5,
			bvmOverriddenAttrs: [],
		} );
		expect( blockEditorDispatch.replaceInnerBlocks ).toHaveBeenCalledWith(
			'c1',
			[
				expect.objectContaining( {
					name: 'core/paragraph',
					attributes: { a: 1 },
				} ),
			],
			false
		);
	} );

	it( 'asks before replacing existing children, honoring both answers', async () => {
		storeMock.ensureVariationLoaded.mockResolvedValue( {
			id: 5,
			inner_blocks: [ [ 'core/paragraph', {}, [] ] ],
		} );
		wireSelect( {
			children: [ { name: 'core/image', innerBlocks: [] } ],
		} );
		const { setAttributes } = renderPanel();
		await waitFor( () =>
			expect( screen.getByText( 'Brand hero' ) ).toBeTruthy()
		);
		await act( async () => {
			fireEvent.change( screen.getByRole( 'combobox' ), {
				target: { value: '5' },
			} );
		} );
		// Nothing applied yet — dialog pending.
		expect( setAttributes ).not.toHaveBeenCalled();

		fireEvent.click( screen.getByText( 'Keep existing children' ) );
		expect( setAttributes ).toHaveBeenCalledWith( {
			bvmVariationId: 5,
			bvmOverriddenAttrs: [],
		} );
		expect(
			blockEditorDispatch.replaceInnerBlocks
		).not.toHaveBeenCalled();

		// Again, confirming replacement this time.
		setAttributes.mockClear();
		await act( async () => {
			fireEvent.change( screen.getByRole( 'combobox' ), {
				target: { value: '5' },
			} );
		} );
		fireEvent.click( screen.getByText( 'Replace children' ) );
		expect( blockEditorDispatch.replaceInnerBlocks ).toHaveBeenCalled();
	} );

	it( 'resets a single override chip, restoring both pair halves', async () => {
		storeMock.getCached.mockReturnValue( {
			id: 5,
			attrs: { bgColor: 'red', bgColorClass: 'has-red', size: 2 },
		} );
		const { setAttributes } = renderPanel( {
			bvmVariationId: 5,
			bvmOverriddenAttrs: [ 'bgColor', 'bgColorClass', 'size' ],
		} );
		await waitFor( () =>
			expect( screen.getByText( 'bgColor ×' ) ).toBeTruthy()
		);
		// Pair collapses into one chip plus the size chip.
		expect( screen.queryByText( 'bgColorClass ×' ) ).toBeNull();

		fireEvent.click( screen.getByText( 'bgColor ×' ) );
		expect( setAttributes ).toHaveBeenCalledWith( {
			bvmOverriddenAttrs: [ 'size' ],
			bgColor: 'red',
			bgColorClass: 'has-red',
		} );
	} );

	it( 'resets all overrides to variation values', async () => {
		storeMock.getCached.mockReturnValue( {
			id: 5,
			attrs: { color: 'red' },
		} );
		const { setAttributes } = renderPanel( {
			bvmVariationId: 5,
			bvmOverriddenAttrs: [ 'color', 'localOnly' ],
		} );
		await waitFor( () =>
			expect( screen.getByText( 'Reset all overrides' ) ).toBeTruthy()
		);
		fireEvent.click( screen.getByText( 'Reset all overrides' ) );
		// localOnly has no variation value — cleared from the list, not written.
		expect( setAttributes ).toHaveBeenCalledWith( {
			bvmOverriddenAttrs: [],
			color: 'red',
		} );
	} );

	it( 'unlinks after confirmation via the More menu', async () => {
		storeMock.getCached.mockReturnValue( { id: 5, attrs: {} } );
		const { setAttributes } = renderPanel( { bvmVariationId: 5 } );
		await waitFor( () => expect( screen.getByText( 'More' ) ).toBeTruthy() );
		fireEvent.click( screen.getByText( 'More' ) );
		fireEvent.click( screen.getByText( 'Unlink from variation' ) );
		fireEvent.click( screen.getByText( 'Unlink' ) );
		expect( setAttributes ).toHaveBeenCalledWith( {
			bvmVariationId: 0,
			bvmOverriddenAttrs: [],
		} );
	} );

	it( 'opens the source variation in a new tab', async () => {
		window.BVM = { adminUrl: '/wp-admin/post.php' };
		const openSpy = jest
			.spyOn( window, 'open' )
			.mockImplementation( () => null );
		storeMock.getCached.mockReturnValue( { id: 5, attrs: {} } );
		renderPanel( { bvmVariationId: 5 } );
		await waitFor( () =>
			expect( screen.getByText( 'Edit source' ) ).toBeTruthy()
		);
		fireEvent.click( screen.getByText( 'Edit source' ) );
		expect( openSpy ).toHaveBeenCalledWith(
			'/wp-admin/post.php?post=5&action=edit',
			'_blank',
			'noopener,noreferrer'
		);
		openSpy.mockRestore();
	} );
} );

describe( 'SavePanel', () => {
	const openSave = async () => {
		await waitFor( () =>
			expect( screen.getByText( 'Save variation' ) ).toBeTruthy()
		);
	};

	it( 'disables saving until a name is entered', async () => {
		renderPanel();
		await openSave();
		expect( screen.getByText( 'Save variation' ).disabled ).toBe( true );
		fireEvent.change( screen.getByPlaceholderText( 'e.g. Brand hero' ), {
			target: { value: 'New hero' },
		} );
		expect( screen.getByText( 'Save variation' ).disabled ).toBe( false );
	} );

	it( 'warns about duplicate names (case-insensitive)', async () => {
		renderPanel();
		await openSave();
		fireEvent.change( screen.getByPlaceholderText( 'e.g. Brand hero' ), {
			target: { value: '  brand HERO ' },
		} );
		expect(
			screen.getByText( /already exists/ )
		).toBeTruthy();
	} );

	it( 'creates a variation from the preset attrs and links the block', async () => {
		storeMock.createVariation.mockResolvedValue( {
			id: 77,
			title: 'New hero',
		} );
		const { setAttributes } = renderPanel( {
			level: 2,
			uniqueID: 'drop-me',
			className: 'drop-me-too',
		} );
		await openSave();
		fireEvent.change( screen.getByPlaceholderText( 'e.g. Brand hero' ), {
			target: { value: 'New hero' },
		} );
		await act( async () => {
			fireEvent.click( screen.getByText( 'Save variation' ) );
		} );

		expect( registryMock.ensureRegistryLoaded ).toHaveBeenCalled();
		expect( createBlock ).toHaveBeenCalledWith(
			'core/heading',
			{ level: 2 },
			[]
		);
		expect( storeMock.createVariation ).toHaveBeenCalledWith( {
			title: 'New hero',
			blockType: 'core/heading',
			attrs: { level: 2 },
			content: serialize(),
			innerBlocks: undefined,
		} );
		expect( setAttributes ).toHaveBeenCalledWith( {
			bvmVariationId: 77,
			bvmOverriddenAttrs: [],
		} );
		// Clean post → auto-saved so the usage count picks up the instance.
		expect( editorDispatch.savePost ).toHaveBeenCalled();
	} );

	it( 'captures live children for block types with required children', async () => {
		registryMock.hasRequiredChildren.mockReturnValue( true );
		const children = [
			{
				name: 'kadence/singlebtn',
				attributes: { text: 'Go', uniqueID: 'drop' },
				innerBlocks: [],
			},
		];
		wireSelect( { children } );
		storeMock.createVariation.mockResolvedValue( { id: 1, title: 'B' } );
		renderPanel( { level: 2 } );
		await openSave();
		fireEvent.change( screen.getByPlaceholderText( 'e.g. Brand hero' ), {
			target: { value: 'B' },
		} );
		await act( async () => {
			fireEvent.click( screen.getByText( 'Save variation' ) );
		} );
		expect( storeMock.createVariation ).toHaveBeenCalledWith(
			expect.objectContaining( {
				innerBlocks: [
					{
						name: 'kadence/singlebtn',
						attributes: { text: 'Go' },
						innerBlocks: [],
					},
				],
			} )
		);
		expect( createBlock ).toHaveBeenCalledWith(
			'core/heading',
			{ level: 2 },
			children
		);
	} );

	it( 'asks before auto-saving a dirty post, honoring both answers', async () => {
		wireSelect( { isDirty: true } );
		storeMock.createVariation.mockResolvedValue( { id: 1, title: 'D' } );
		renderPanel( { level: 2 } );
		await openSave();
		fireEvent.change( screen.getByPlaceholderText( 'e.g. Brand hero' ), {
			target: { value: 'D' },
		} );
		await act( async () => {
			fireEvent.click( screen.getByText( 'Save variation' ) );
		} );
		// No save yet — dialog pending.
		expect( storeMock.createVariation ).not.toHaveBeenCalled();

		// "Create variation only" → saved without committing the post.
		await act( async () => {
			fireEvent.click( screen.getByText( 'Create variation only' ) );
		} );
		expect( storeMock.createVariation ).toHaveBeenCalledTimes( 1 );
		expect( editorDispatch.savePost ).not.toHaveBeenCalled();
	} );

	it( 'commits the post too when the user confirms', async () => {
		wireSelect( { isDirty: true } );
		storeMock.createVariation.mockResolvedValue( { id: 1, title: 'D' } );
		renderPanel( { level: 2 } );
		await openSave();
		fireEvent.change( screen.getByPlaceholderText( 'e.g. Brand hero' ), {
			target: { value: 'D' },
		} );
		await act( async () => {
			fireEvent.click( screen.getByText( 'Save variation' ) );
		} );
		await act( async () => {
			fireEvent.click(
				screen.getByText( 'Save page and variation' )
			);
		} );
		expect( editorDispatch.savePost ).toHaveBeenCalled();
	} );

	it( 'surfaces save errors', async () => {
		storeMock.createVariation.mockRejectedValue(
			new Error( 'duplicate key' )
		);
		renderPanel( { level: 2 } );
		await openSave();
		fireEvent.change( screen.getByPlaceholderText( 'e.g. Brand hero' ), {
			target: { value: 'X' },
		} );
		await act( async () => {
			fireEvent.click( screen.getByText( 'Save variation' ) );
		} );
		expect( screen.getByText( 'duplicate key' ) ).toBeTruthy();
	} );
} );
