import {
	BVM_ATTR_VARIATION_ID,
	BVM_ATTR_OVERRIDES,
	INTERNAL_ATTRS,
	PRESET_EXCLUDED_ATTRS,
} from '../../source/constants.js';

/**
 * These pin the §9 contract: the excluded sets are mirrored in PHP
 * (Attributes::excluded_attrs()) — a drive-by edit here must fail loudly.
 */
describe( 'constants', () => {
	it( 'exposes the bookkeeping attribute names', () => {
		expect( BVM_ATTR_VARIATION_ID ).toBe( 'bvmVariationId' );
		expect( BVM_ATTR_OVERRIDES ).toBe( 'bvmOverriddenAttrs' );
	} );

	it( 'INTERNAL_ATTRS contains exactly the bookkeeping set', () => {
		expect( [ ...INTERNAL_ATTRS ].sort() ).toEqual(
			[
				'bvmVariationId',
				'bvmOverriddenAttrs',
				'className',
				'anchor',
				'lock',
				'metadata',
			].sort()
		);
	} );

	it( 'PRESET_EXCLUDED_ATTRS is INTERNAL_ATTRS plus per-instance identity attrs', () => {
		for ( const key of INTERNAL_ATTRS ) {
			expect( PRESET_EXCLUDED_ATTRS.has( key ) ).toBe( true );
		}
		expect( PRESET_EXCLUDED_ATTRS.has( 'uniqueID' ) ).toBe( true );
		expect( PRESET_EXCLUDED_ATTRS.has( 'uniqueId' ) ).toBe( true );
		expect( PRESET_EXCLUDED_ATTRS.size ).toBe( INTERNAL_ATTRS.size + 2 );
	} );
} );
