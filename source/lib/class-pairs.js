/**
 * Kadence (and some other WP block libs) store color-like attributes as a
 * pair: `fooColor` holds the palette slug/hex, `fooColorClass` holds the CSS
 * class, and pickers fire the two halves in separate setAttributes calls.
 * Tracking and resetting them as a pair keeps override state consistent from
 * the first call. Shared by the override tracker and the sidebar panel so the
 * two can never disagree about what constitutes a pair.
 */
export function kadenceClassPair( key ) {
	if ( key.endsWith( 'Class' ) && key.length > 5 ) {
		return key.slice( 0, -5 );
	}
	return key + 'Class';
}

/** Base key for a class-pair — strips the `Class` suffix when present. */
export function pairBaseKey( key ) {
	return key.endsWith( 'Class' ) && key.length > 5 ? key.slice( 0, -5 ) : key;
}
