/**
 * Shallow-ish equality check good enough for comparing block attribute values.
 * Handles primitives, arrays, and plain objects up to reasonable depth.
 */
export function deepEqual( a, b ) {
	if ( a === b ) {
		return true;
	}
	if ( a === null || b === null || a === undefined || b === undefined ) {
		return a === b;
	}
	if ( typeof a !== typeof b ) {
		return false;
	}
	if ( typeof a !== 'object' ) {
		return false;
	}
	if ( Array.isArray( a ) ) {
		if ( ! Array.isArray( b ) || a.length !== b.length ) {
			return false;
		}
		for ( let i = 0; i < a.length; i++ ) {
			if ( ! deepEqual( a[ i ], b[ i ] ) ) {
				return false;
			}
		}
		return true;
	}
	const keysA = Object.keys( a );
	const keysB = Object.keys( b );
	if ( keysA.length !== keysB.length ) {
		return false;
	}
	for ( const key of keysA ) {
		if ( ! deepEqual( a[ key ], b[ key ] ) ) {
			return false;
		}
	}
	return true;
}
