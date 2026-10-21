import {
	extractPresetAttrs,
	shapeInnerBlocks,
} from '../../../source/lib/preset.js';
import { PRESET_EXCLUDED_ATTRS } from '../../../source/constants.js';

describe( 'extractPresetAttrs', () => {
	it( 'passes through ordinary attributes', () => {
		expect(
			extractPresetAttrs( { level: 2, content: 'Hi', align: 'wide' } )
		).toEqual( { level: 2, content: 'Hi', align: 'wide' } );
	} );

	// §9 invariant: excluded attrs must never enter a preset.
	it.each( [ ...PRESET_EXCLUDED_ATTRS ] )(
		'strips excluded attr %s',
		( key ) => {
			const out = extractPresetAttrs( { [ key ]: 'x', keep: 1 } );
			expect( out ).not.toHaveProperty( key );
			expect( out ).toEqual( { keep: 1 } );
		}
	);

	it( 'drops undefined values but keeps other falsy values', () => {
		expect(
			extractPresetAttrs( {
				a: undefined,
				b: null,
				c: 0,
				d: '',
				e: false,
			} )
		).toEqual( { b: null, c: 0, d: '', e: false } );
	} );

	it( 'returns an empty object for empty input', () => {
		expect( extractPresetAttrs( {} ) ).toEqual( {} );
	} );
} );

describe( 'shapeInnerBlocks', () => {
	it( 'returns [] for non-array input', () => {
		expect( shapeInnerBlocks( undefined ) ).toEqual( [] );
		expect( shapeInnerBlocks( null ) ).toEqual( [] );
		expect( shapeInnerBlocks( 'nope' ) ).toEqual( [] );
	} );

	it( 'drops entries without a valid block name', () => {
		expect(
			shapeInnerBlocks( [
				null,
				{},
				{ name: '' },
				{ name: 'core/paragraph', attributes: { content: 'ok' } },
			] )
		).toEqual( [
			{
				name: 'core/paragraph',
				attributes: { content: 'ok' },
				innerBlocks: [],
			},
		] );
	} );

	it( 'strips excluded attrs at every depth', () => {
		const tree = shapeInnerBlocks( [
			{
				name: 'core/group',
				attributes: { uniqueID: 'abc', align: 'full' },
				innerBlocks: [
					{
						name: 'core/paragraph',
						attributes: { className: 'x', content: 'deep' },
					},
				],
			},
		] );
		expect( tree[ 0 ].attributes ).toEqual( { align: 'full' } );
		expect( tree[ 0 ].innerBlocks[ 0 ].attributes ).toEqual( {
			content: 'deep',
		} );
	} );

	// §9.16 invariant: a linked child is opaque — only its link is captured.
	it( 'captures only bvmVariationId for linked children', () => {
		const tree = shapeInnerBlocks( [
			{
				name: 'kadence/column',
				attributes: {
					bvmVariationId: '42',
					background: 'red',
					uniqueID: 'k1',
				},
				innerBlocks: [
					{
						name: 'core/paragraph',
						attributes: { content: 'child content' },
					},
				],
			},
		] );
		expect( tree[ 0 ].attributes ).toEqual( { bvmVariationId: 42 } );
		// Children below a linked child are still shaped (structure preserved).
		expect( tree[ 0 ].innerBlocks ).toEqual( [
			{
				name: 'core/paragraph',
				attributes: { content: 'child content' },
				innerBlocks: [],
			},
		] );
	} );

	it( 'treats non-positive or non-numeric bvmVariationId as unlinked', () => {
		const tree = shapeInnerBlocks( [
			{ name: 'core/group', attributes: { bvmVariationId: 0, a: 1 } },
			{ name: 'core/group', attributes: { bvmVariationId: 'x', a: 2 } },
		] );
		// Unlinked: full preset extraction applies (bvmVariationId itself is excluded).
		expect( tree[ 0 ].attributes ).toEqual( { a: 1 } );
		expect( tree[ 1 ].attributes ).toEqual( { a: 2 } );
	} );

	it( 'handles missing attributes safely', () => {
		expect( shapeInnerBlocks( [ { name: 'core/spacer' } ] ) ).toEqual( [
			{ name: 'core/spacer', attributes: {}, innerBlocks: [] },
		] );
	} );
} );
