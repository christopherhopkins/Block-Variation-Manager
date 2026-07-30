import apiFetch from '@wordpress/api-fetch';
import { restPath } from './rest-path.js';

const listeners = new Set();
const cache = new Map(); // id -> variation object, or null = confirmed missing
const listCache = new Map(); // block_type -> array
const inflight = new Map(); // id -> Promise
const inflightLists = new Map(); // block_type -> Promise

/**
 * Monotonic change counter. useSyncExternalStore consumers snapshot this —
 * it actually changes on every mutation, unlike a constant sentinel key
 * (which never triggers a re-render no matter how often notify() fires).
 */
let version = 0;

function notify() {
	version++;
	for ( const fn of listeners ) {
		fn();
	}
}

export function subscribe( listener ) {
	listeners.add( listener );
	return () => listeners.delete( listener );
}

export function getVersion() {
	return version;
}

/**
 * Three states, and callers rely on the distinction:
 *   undefined — never fetched (loading/unknown)
 *   null      — confirmed missing (deleted/unpublished variation)
 *   object    — loaded record
 */
export function getCached( id ) {
	return cache.has( id ) ? cache.get( id ) : undefined;
}

export function fetchVariation( id ) {
	if ( ! id ) {
		return Promise.resolve( null );
	}
	if ( inflight.has( id ) ) {
		return inflight.get( id );
	}
	const promise = apiFetch( { path: restPath( `/variations/${ id }` ) } )
		.then( ( data ) => {
			inflight.delete( id );
			cache.set( id, data );
			notify();
			return data;
		} )
		.catch( ( err ) => {
			inflight.delete( id );
			// Only a definitive "gone" is negative-cached. Transient failures
			// (network, 5xx, expired nonce) stay uncached so the next mount
			// retries — permanently caching them disabled override tracking
			// for the whole session while the server kept merging the
			// variation into every render.
			if ( 404 === err?.data?.status || 'bvm_not_found' === err?.code ) {
				cache.set( id, null );
				notify();
				return null;
			}
			throw err;
		} );
	inflight.set( id, promise );
	return promise;
}

export function ensureVariationLoaded( id ) {
	if ( ! id ) {
		return Promise.resolve( null );
	}
	if ( cache.has( id ) ) {
		return Promise.resolve( cache.get( id ) );
	}
	return fetchVariation( id ).catch( () => null );
}

export async function listForBlockType( blockType ) {
	if ( listCache.has( blockType ) ) {
		return listCache.get( blockType );
	}
	if ( inflightLists.has( blockType ) ) {
		return inflightLists.get( blockType );
	}
	const promise = apiFetch( {
		path: restPath(
			`/variations?block_type=${ encodeURIComponent( blockType ) }`
		),
	} )
		.then( ( data ) => {
			listCache.set( blockType, data );
			for ( const variation of data ) {
				cache.set( variation.id, variation );
			}
			inflightLists.delete( blockType );
			notify();
			return data;
		} )
		.catch( ( err ) => {
			inflightLists.delete( blockType );
			throw err;
		} );
	inflightLists.set( blockType, promise );
	return promise;
}

export async function listInstances( variationId ) {
	if ( ! variationId ) return [];
	const data = await apiFetch( {
		path: restPath( `/variations/${ variationId }/instances` ),
	} );
	return Array.isArray( data?.instances ) ? data.instances : [];
}

export function invalidateList( blockType ) {
	if ( blockType ) {
		listCache.delete( blockType );
	} else {
		listCache.clear();
	}
	notify();
}

export async function createVariation( {
	title,
	blockType,
	attrs,
	content,
	innerBlocks,
} ) {
	const body = { title, block_type: blockType, attrs, content };
	if ( Array.isArray( innerBlocks ) ) {
		body.inner_blocks = innerBlocks;
	}
	const data = await apiFetch( {
		path: restPath( '/variations' ),
		method: 'POST',
		data: body,
	} );
	cache.set( data.id, data );
	invalidateList( blockType );
	return data;
}

export async function updateVariation( id, payload ) {
	const body = {};
	if ( 'title' in payload ) body.title = payload.title;
	if ( 'attrs' in payload ) body.attrs = payload.attrs;
	if ( 'innerBlocks' in payload ) body.inner_blocks = payload.innerBlocks;
	const data = await apiFetch( {
		path: restPath( `/variations/${ id }` ),
		method: 'PUT',
		data: body,
	} );
	cache.set( data.id, data );
	invalidateList( data.block_type );
	return data;
}
