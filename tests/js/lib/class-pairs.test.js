import {
	kadenceClassPair,
	pairBaseKey,
} from '../../../source/lib/class-pairs.js';

describe( 'kadenceClassPair', () => {
	it( 'maps a base key to its Class twin', () => {
		expect( kadenceClassPair( 'backgroundColor' ) ).toBe(
			'backgroundColorClass'
		);
	} );

	it( 'maps a Class key back to its base twin', () => {
		expect( kadenceClassPair( 'backgroundColorClass' ) ).toBe(
			'backgroundColor'
		);
	} );

	it( 'is an involution (pair of a pair is the original)', () => {
		for ( const key of [ 'color', 'colorClass', 'x' ] ) {
			expect( kadenceClassPair( kadenceClassPair( key ) ) ).toBe( key );
		}
	} );

	it( 'treats the bare key "Class" as a base key, not a suffix match', () => {
		expect( kadenceClassPair( 'Class' ) ).toBe( 'ClassClass' );
	} );
} );

describe( 'pairBaseKey', () => {
	it( 'strips the Class suffix', () => {
		expect( pairBaseKey( 'linkColorClass' ) ).toBe( 'linkColor' );
	} );

	it( 'returns non-Class keys unchanged', () => {
		expect( pairBaseKey( 'linkColor' ) ).toBe( 'linkColor' );
	} );

	it( 'agrees with kadenceClassPair on what constitutes a pair', () => {
		for ( const key of [ 'fooColor', 'fooColorClass', 'Class', 'aClass' ] ) {
			expect( pairBaseKey( key ) ).toBe(
				pairBaseKey( kadenceClassPair( key ) )
			);
		}
	} );
} );
