import { render, act } from '@testing-library/react';

const mockAddFilter = jest.fn();
jest.mock( '@wordpress/hooks', () => ( { addFilter: mockAddFilter } ) );

jest.mock( '../../../source/lib/variation-store.js', () => ( {
	subscribe: jest.fn( () => () => {} ),
	getCached: jest.fn(),
	ensureVariationLoaded: jest.fn( () => Promise.resolve( null ) ),
} ) );

const {
	getCached,
	ensureVariationLoaded,
} = require( '../../../source/lib/variation-store.js' );

require( '../../../source/filters/track-overrides.js' );

const hoc = mockAddFilter.mock.calls.find(
	( c ) => c[ 1 ] === 'bvm/track-overrides'
)[ 2 ];

/** Record store: getCached returns stable references per id. */
const records = new Map();

// Capture props passed to the wrapped BlockEdit.
let innerProps;
const ProbeEdit = ( props ) => {
	innerProps = props;
	return null;
};
const WrappedProbe = hoc( ProbeEdit );

function renderProbe( attributes ) {
	const setAttributes = jest.fn();
	const utils = render(
		<WrappedProbe
			attributes={ attributes }
			setAttributes={ setAttributes }
		/>
	);
	return { setAttributes, rerender: utils.rerender };
}

beforeEach( () => {
	records.clear();
	innerProps = undefined;
	getCached.mockImplementation( ( id ) => records.get( id ) );
	ensureVariationLoaded.mockClear();
	ensureVariationLoaded.mockImplementation( () => Promise.resolve( null ) );
} );

describe( 'registration', () => {
	it( 'hooks editor.BlockEdit', () => {
		expect( mockAddFilter ).toHaveBeenCalledWith(
			'editor.BlockEdit',
			'bvm/track-overrides',
			expect.any( Function )
		);
	} );
} );

describe( 'unlinked blocks', () => {
	it( 'passes setAttributes through untouched and loads nothing', () => {
		const { setAttributes } = renderProbe( { content: 'x' } );
		act( () => innerProps.setAttributes( { content: 'y' } ) );
		expect( setAttributes ).toHaveBeenCalledWith( { content: 'y' } );
		expect( ensureVariationLoaded ).not.toHaveBeenCalled();
	} );
} );

describe( 'override tracking (variation loaded)', () => {
	const VARIATION = { id: 5, attrs: { color: 'red', size: 2 } };

	beforeEach( () => {
		records.set( 5, VARIATION );
	} );

	it( 'requests the variation record on mount', () => {
		renderProbe( {
			bvmVariationId: 5,
			color: 'red',
			size: 2,
			bvmOverriddenAttrs: [],
		} );
		expect( ensureVariationLoaded ).toHaveBeenCalledWith( 5 );
	} );

	it( 'marks an attr overridden when set to a non-variation value', () => {
		const { setAttributes } = renderProbe( {
			bvmVariationId: 5,
			color: 'red',
			size: 2,
			bvmOverriddenAttrs: [],
		} );
		setAttributes.mockClear();
		act( () => innerProps.setAttributes( { color: 'blue' } ) );
		expect( setAttributes ).toHaveBeenCalledWith( {
			color: 'blue',
			bvmOverriddenAttrs: [ 'color' ],
		} );
	} );

	it( 'unmarks when set back to the variation value', () => {
		const { setAttributes } = renderProbe( {
			bvmVariationId: 5,
			color: 'blue',
			size: 2,
			bvmOverriddenAttrs: [ 'color' ],
		} );
		setAttributes.mockClear();
		act( () => innerProps.setAttributes( { color: 'red' } ) );
		expect( setAttributes ).toHaveBeenCalledWith( {
			color: 'red',
			bvmOverriddenAttrs: [],
		} );
	} );

	it( 'ignores attrs the variation does not define', () => {
		const { setAttributes } = renderProbe( {
			bvmVariationId: 5,
			color: 'red',
			size: 2,
			content: 'a',
			bvmOverriddenAttrs: [],
		} );
		setAttributes.mockClear();
		act( () => innerProps.setAttributes( { content: 'b' } ) );
		expect( setAttributes ).toHaveBeenCalledWith( { content: 'b' } );
	} );

	it( 'never tracks internal bookkeeping attrs', () => {
		const { setAttributes } = renderProbe( {
			bvmVariationId: 5,
			color: 'red',
			size: 2,
			bvmOverriddenAttrs: [],
		} );
		setAttributes.mockClear();
		act( () => innerProps.setAttributes( { className: 'custom' } ) );
		expect( setAttributes ).toHaveBeenCalledWith( {
			className: 'custom',
		} );
	} );

	it( 'accumulates marks across two same-tick calls (ref-based list)', () => {
		const { setAttributes } = renderProbe( {
			bvmVariationId: 5,
			color: 'red',
			size: 2,
			bvmOverriddenAttrs: [],
		} );
		setAttributes.mockClear();
		act( () => {
			innerProps.setAttributes( { color: 'blue' } );
			innerProps.setAttributes( { size: 9 } );
		} );
		expect( setAttributes ).toHaveBeenNthCalledWith( 1, {
			color: 'blue',
			bvmOverriddenAttrs: [ 'color' ],
		} );
		expect( setAttributes ).toHaveBeenNthCalledWith( 2, {
			size: 9,
			bvmOverriddenAttrs: [ 'color', 'size' ],
		} );
	} );
} );

describe( 'class-pair tracking', () => {
	const VARIATION = {
		id: 6,
		attrs: { bgColor: 'red', bgColorClass: 'has-red' },
	};

	beforeEach( () => {
		records.set( 6, VARIATION );
	} );

	it( 'marks both halves when one diverges and the pair exists on the variation', () => {
		const { setAttributes } = renderProbe( {
			bvmVariationId: 6,
			bgColor: 'red',
			bgColorClass: 'has-red',
			bvmOverriddenAttrs: [],
		} );
		setAttributes.mockClear();
		act( () => innerProps.setAttributes( { bgColor: 'blue' } ) );
		expect( setAttributes ).toHaveBeenCalledWith( {
			bgColor: 'blue',
			bvmOverriddenAttrs: [ 'bgColor', 'bgColorClass' ],
		} );
	} );

	it( 'unmarks the sibling when both halves match the variation again', () => {
		const { setAttributes } = renderProbe( {
			bvmVariationId: 6,
			bgColor: 'blue',
			bgColorClass: 'has-red',
			bvmOverriddenAttrs: [ 'bgColor', 'bgColorClass' ],
		} );
		setAttributes.mockClear();
		act( () => innerProps.setAttributes( { bgColor: 'red' } ) );
		expect( setAttributes ).toHaveBeenCalledWith( {
			bgColor: 'red',
			bvmOverriddenAttrs: [],
		} );
	} );

	it( 'keeps the sibling marked while its live value still diverges', () => {
		const { setAttributes } = renderProbe( {
			bvmVariationId: 6,
			bgColor: 'blue',
			bgColorClass: 'has-blue',
			bvmOverriddenAttrs: [ 'bgColor', 'bgColorClass' ],
		} );
		setAttributes.mockClear();
		act( () => innerProps.setAttributes( { bgColor: 'red' } ) );
		expect( setAttributes ).toHaveBeenCalledWith( {
			bgColor: 'red',
			bvmOverriddenAttrs: [ 'bgColorClass' ],
		} );
	} );
} );

describe( 'type-mismatched links (§9.8 / COR-5)', () => {
	it( 'neither syncs nor tracks when the block name differs from block_type', () => {
		records.set( 9, {
			id: 9,
			block_type: 'core/paragraph',
			attrs: { color: 'red' },
		} );
		// ProbeEdit renders as a core/heading-shaped block (no name prop in
		// the probe by default — pass one).
		const setAttributes = jest.fn();
		render(
			<WrappedProbe
				name="core/heading"
				attributes={ {
					bvmVariationId: 9,
					color: 'stale',
					bvmOverriddenAttrs: [],
				} }
				setAttributes={ setAttributes }
			/>
		);
		// No sync write of the foreign attrs…
		expect( setAttributes ).not.toHaveBeenCalled();
		// …and user edits pass through untracked.
		act( () => innerProps.setAttributes( { color: 'blue' } ) );
		expect( setAttributes ).toHaveBeenCalledWith( { color: 'blue' } );
	} );

	it( 'matching names keep syncing as before', () => {
		records.set( 9, {
			id: 9,
			block_type: 'core/heading',
			attrs: { color: 'red' },
		} );
		const setAttributes = jest.fn();
		render(
			<WrappedProbe
				name="core/heading"
				attributes={ {
					bvmVariationId: 9,
					color: 'stale',
					bvmOverriddenAttrs: [],
				} }
				setAttributes={ setAttributes }
			/>
		);
		expect( setAttributes ).toHaveBeenCalledWith( { color: 'red' } );
	} );
} );

describe( 'record still loading', () => {
	it( 'marks conservatively while the record is undefined', () => {
		// id 7 never enters the record map → getCached returns undefined.
		const { setAttributes } = renderProbe( {
			bvmVariationId: 7,
			color: 'red',
			bvmOverriddenAttrs: [],
		} );
		setAttributes.mockClear();
		act( () => innerProps.setAttributes( { color: 'red' } ) );
		expect( setAttributes ).toHaveBeenCalledWith( {
			color: 'red',
			bvmOverriddenAttrs: [ 'color' ],
		} );
	} );

	it( 'does not track against a confirmed-missing (null) record', () => {
		records.set( 8, null );
		const { setAttributes } = renderProbe( {
			bvmVariationId: 8,
			color: 'red',
			bvmOverriddenAttrs: [],
		} );
		setAttributes.mockClear();
		act( () => innerProps.setAttributes( { color: 'blue' } ) );
		expect( setAttributes ).toHaveBeenCalledWith( { color: 'blue' } );
	} );
} );

describe( 'sync effect (variation → store)', () => {
	it( 'writes differing non-overridden attrs into the block on mount', () => {
		records.set( 5, { id: 5, attrs: { color: 'red', size: 2 } } );
		const { setAttributes } = renderProbe( {
			bvmVariationId: 5,
			color: 'stale',
			size: 2,
			bvmOverriddenAttrs: [],
		} );
		expect( setAttributes ).toHaveBeenCalledWith( { color: 'red' } );
	} );

	it( 'never clobbers overridden attrs', () => {
		records.set( 5, { id: 5, attrs: { color: 'red', size: 2 } } );
		const { setAttributes } = renderProbe( {
			bvmVariationId: 5,
			color: 'blue',
			size: 7,
			bvmOverriddenAttrs: [ 'color' ],
		} );
		expect( setAttributes ).toHaveBeenCalledWith( { size: 2 } );
		// color stays untouched in every call.
		for ( const call of setAttributes.mock.calls ) {
			expect( call[ 0 ] ).not.toHaveProperty( 'color' );
		}
	} );

	it( 'drops stale override marks the variation does not define', () => {
		records.set( 5, { id: 5, attrs: { color: 'red' } } );
		const { setAttributes } = renderProbe( {
			bvmVariationId: 5,
			color: 'red',
			bvmOverriddenAttrs: [ 'ghost' ],
		} );
		expect( setAttributes ).toHaveBeenCalledWith( {
			bvmOverriddenAttrs: [],
		} );
	} );

	it( 'drops conservative marks whose value matches after load', () => {
		records.set( 5, { id: 5, attrs: { color: 'red' } } );
		const { setAttributes } = renderProbe( {
			bvmVariationId: 5,
			color: 'red',
			bvmOverriddenAttrs: [ 'color' ],
		} );
		expect( setAttributes ).toHaveBeenCalledWith( {
			bvmOverriddenAttrs: [],
		} );
	} );

	it( 'does nothing when everything is in sync', () => {
		records.set( 5, { id: 5, attrs: { color: 'red' } } );
		const { setAttributes } = renderProbe( {
			bvmVariationId: 5,
			color: 'red',
			bvmOverriddenAttrs: [],
		} );
		expect( setAttributes ).not.toHaveBeenCalled();
	} );
} );
