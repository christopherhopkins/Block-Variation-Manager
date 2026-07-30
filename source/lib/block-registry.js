import apiFetch from '@wordpress/api-fetch';
import { restPath } from './rest-path.js';

/**
 * REST-backed mirror of the PHP BlockRegistry.
 *
 * Loaded lazily on first access. Used by SavePanel (decide whether to capture
 * inner blocks) and SourcePanel (decide whether to prompt before replacing
 * existing children on apply). Callers on save paths should `await
 * ensureRegistryLoaded()` before consulting the sync accessors — the cache
 * starts empty and a pre-load read returns the EMPTY policy.
 */

let cache = null;
let inflight = null;

const EMPTY = { required_children: [] };

export function ensureRegistryLoaded() {
	if ( cache || inflight ) return inflight ?? Promise.resolve( cache );
	inflight = apiFetch( { path: restPath( '/registry' ) } )
		.then( ( data ) => {
			cache = data && typeof data === 'object' ? data : {};
			inflight = null;
			return cache;
		} )
		.catch( () => {
			// Leave the cache unset so the next call retries — one failed
			// fetch (security-plugin 403, transient 500) must not silently
			// disable required-children capture for the whole session.
			inflight = null;
			return null;
		} );
	return inflight;
}

function entry( blockName ) {
	if ( ! cache ) return EMPTY;
	return cache[ blockName ] ?? EMPTY;
}

export function hasRequiredChildren( blockName ) {
	const e = entry( blockName );
	return (
		Array.isArray( e.required_children ) && e.required_children.length > 0
	);
}
