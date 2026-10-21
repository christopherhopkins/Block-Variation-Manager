const mockAddFilter = jest.fn();
jest.mock( '@wordpress/hooks', () => ( { addFilter: mockAddFilter } ) );

describe( 'extend-attributes filter', () => {
	let extend;

	beforeAll( () => {
		jest.isolateModules( () => {
			require( '../../../source/filters/extend-attributes.js' );
		} );
		expect( mockAddFilter ).toHaveBeenCalledWith(
			'blocks.registerBlockType',
			'bvm/extend-attributes',
			expect.any( Function )
		);
		extend = mockAddFilter.mock.calls[ 0 ][ 2 ];
	} );

	it( 'adds both bookkeeping attributes with correct schema', () => {
		const settings = extend( { attributes: { level: { type: 'number' } } } );
		expect( settings.attributes.bvmVariationId ).toEqual( {
			type: 'number',
			default: 0,
		} );
		expect( settings.attributes.bvmOverriddenAttrs ).toEqual( {
			type: 'array',
			default: [],
			items: { type: 'string' },
		} );
		expect( settings.attributes.level ).toEqual( { type: 'number' } );
	} );

	it( 'creates the attributes bag when absent', () => {
		const settings = extend( {} );
		expect( settings.attributes.bvmVariationId ).toBeDefined();
		expect( settings.attributes.bvmOverriddenAttrs ).toBeDefined();
	} );

	it( 'respects an existing definition instead of clobbering it', () => {
		const custom = { type: 'number', default: 7 };
		const settings = extend( {
			attributes: { bvmVariationId: custom },
		} );
		expect( settings.attributes.bvmVariationId ).toBe( custom );
	} );
} );
