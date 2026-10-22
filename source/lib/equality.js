/**
 * Rich-text attribute values arrive from the editor store as RichTextData
 * objects (WP 6.5+), while a variation's preset holds the serialized string.
 * Comparing them as-is is always unequal, which dirtied every post on open
 * and made rich-text overrides impossible to un-mark (COR-11). Normalize
 * anything exposing toHTMLString() to its string form before comparing.
 */
function normalize( value ) {
	if (
		value &&
		typeof value === 'object' &&
		typeof value.toHTMLString === 'function'
	) {
		return value.toHTMLString();
	}
	return value;
}

/**
 * Shallow-ish equality check good enough for comparing block attribute values.
 * Handles primitives, arrays, and plain objects up to reasonable depth.
 */
export function deepEqual( a, b ) {
	a = normalize( a );
	b = normalize( b );
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
