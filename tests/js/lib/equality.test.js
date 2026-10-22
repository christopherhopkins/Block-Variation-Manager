import { deepEqual } from '../../../source/lib/equality.js';

describe( 'deepEqual', () => {
	it( 'treats identical primitives as equal', () => {
		expect( deepEqual( 1, 1 ) ).toBe( true );
		expect( deepEqual( 'a', 'a' ) ).toBe( true );
		expect( deepEqual( true, true ) ).toBe( true );
	} );

	it( 'treats differing primitives as unequal', () => {
		expect( deepEqual( 1, 2 ) ).toBe( false );
		expect( deepEqual( 'a', 'b' ) ).toBe( false );
		expect( deepEqual( true, false ) ).toBe( false );
	} );

	it( 'does not coerce across types', () => {
		expect( deepEqual( 1, '1' ) ).toBe( false );
		expect( deepEqual( 0, false ) ).toBe( false );
		expect( deepEqual( '', false ) ).toBe( false );
	} );

	it( 'handles null and undefined strictly', () => {
		expect( deepEqual( null, null ) ).toBe( true );
		expect( deepEqual( undefined, undefined ) ).toBe( true );
		expect( deepEqual( null, undefined ) ).toBe( false );
		expect( deepEqual( null, {} ) ).toBe( false );
		expect( deepEqual( undefined, 0 ) ).toBe( false );
	} );

	it( 'compares arrays element-wise', () => {
		expect( deepEqual( [ 1, 2, 3 ], [ 1, 2, 3 ] ) ).toBe( true );
		expect( deepEqual( [ 1, 2, 3 ], [ 1, 2 ] ) ).toBe( false );
		expect( deepEqual( [ 1, 2, 3 ], [ 1, 2, 4 ] ) ).toBe( false );
		expect( deepEqual( [], [] ) ).toBe( true );
	} );

	it( 'distinguishes arrays from objects', () => {
		expect( deepEqual( [], {} ) ).toBe( false );
		expect( deepEqual( { 0: 'a', length: 1 }, [ 'a' ] ) ).toBe( false );
	} );

	it( 'compares plain objects by keys and values', () => {
		expect( deepEqual( { a: 1, b: 2 }, { b: 2, a: 1 } ) ).toBe( true );
		expect( deepEqual( { a: 1 }, { a: 1, b: undefined } ) ).toBe( false );
		expect( deepEqual( { a: 1 }, { a: 2 } ) ).toBe( false );
		expect( deepEqual( {}, {} ) ).toBe( true );
	} );

	it( 'recurses into nested structures (block-attribute shapes)', () => {
		const a = {
			padding: { top: '10px', bottom: '10px' },
			colors: [ { slug: 'primary', hex: '#123456' } ],
		};
		const same = {
			padding: { top: '10px', bottom: '10px' },
			colors: [ { slug: 'primary', hex: '#123456' } ],
		};
		const diff = {
			padding: { top: '10px', bottom: '12px' },
			colors: [ { slug: 'primary', hex: '#123456' } ],
		};
		expect( deepEqual( a, same ) ).toBe( true );
		expect( deepEqual( a, diff ) ).toBe( false );
	} );

	it( 'is reflexive on the same reference', () => {
		const obj = { a: [ 1, { b: 2 } ] };
		expect( deepEqual( obj, obj ) ).toBe( true );
	} );

	// COR-11: WP 6.5+ hands rich-text attrs to the editor as RichTextData
	// objects while the variation preset stores strings — they must compare
	// by their HTML string, or every open rewrites identical text.
	describe( 'RichTextData normalization', () => {
		const richText = ( html ) => ( {
			toHTMLString: () => html,
			toString: () => html,
		} );

		it( 'treats RichTextData equal to its serialized string', () => {
			expect( deepEqual( richText( 'Hello <em>x</em>' ), 'Hello <em>x</em>' ) ).toBe( true );
			expect( deepEqual( 'Hello <em>x</em>', richText( 'Hello <em>x</em>' ) ) ).toBe( true );
		} );

		it( 'still detects real text differences', () => {
			expect( deepEqual( richText( 'Hello' ), 'Goodbye' ) ).toBe( false );
		} );

		it( 'compares two RichTextData values by content', () => {
			expect( deepEqual( richText( 'same' ), richText( 'same' ) ) ).toBe( true );
			expect( deepEqual( richText( 'a' ), richText( 'b' ) ) ).toBe( false );
		} );

		it( 'normalizes nested values inside attribute objects', () => {
			expect(
				deepEqual( { content: richText( 'deep' ) }, { content: 'deep' } )
			).toBe( true );
		} );

		it( 'does not coerce unrelated objects', () => {
			expect( deepEqual( { toString: () => 'x' }, 'x' ) ).toBe( false );
		} );
	} );
} );
