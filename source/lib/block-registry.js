import apiFetch from '@wordpress/api-fetch';

/**
 * REST-backed mirror of the PHP BlockRegistry.
 *
 * Loaded lazily on first access. Used by SavePanel (decide whether to capture
 * inner blocks) and SourcePanel (decide whether to prompt before replacing
 * existing children on apply).
 */

let cache = null;
let inflight = null;

const EMPTY = { required_children: [], preset_capable: false };

export function ensureRegistryLoaded() {
	if ( cache || inflight ) return inflight ?? Promise.resolve( cache );
	inflight = apiFetch( {
		path: `/${ window.BVM?.restNamespace ?? 'bvm/v1' }/registry`,
	} )
		.then( ( data ) => {
			cache = data && typeof data === 'object' ? data : {};
			inflight = null;
			return cache;
		} )
		.catch( () => {
			cache = {};
			inflight = null;
			return cache;
		} );
	return inflight;
}

function entry( blockName ) {
	if ( ! cache ) return EMPTY;
	return cache[ blockName ] ?? EMPTY;
}

export function hasRequiredChildren( blockName ) {
	const e = entry( blockName );
	return Array.isArray( e.required_children ) && e.required_children.length > 0;
}

export function requiredChildren( blockName ) {
	const e = entry( blockName );
	return Array.isArray( e.required_children ) ? e.required_children : [];
}

export function isPresetCapable( blockName ) {
	return Boolean( entry( blockName ).preset_capable );
}
