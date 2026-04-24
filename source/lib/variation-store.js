import apiFetch from '@wordpress/api-fetch';

const listeners = new Set();
const cache = new Map(); // id -> variation object
const listCache = new Map(); // block_type -> array
let inflightLists = new Map(); // block_type -> Promise

function notify() {
	for ( const fn of listeners ) {
		fn();
	}
}

export function subscribe( listener ) {
	listeners.add( listener );
	return () => listeners.delete( listener );
}

export function getCached( id ) {
	return cache.get( id ) ?? null;
}

export async function fetchVariation( id ) {
	if ( ! id ) {
		return null;
	}
	const path = `/${ window.BVM?.restNamespace ?? 'bvm/v1' }/variations/${ id }`;
	const data = await apiFetch( { path } );
	cache.set( id, data );
	notify();
	return data;
}

export function ensureVariationLoaded( id ) {
	if ( ! id ) {
		return Promise.resolve( null );
	}
	if ( cache.has( id ) ) {
		return Promise.resolve( cache.get( id ) );
	}
	return fetchVariation( id ).catch( () => {
		// Variation deleted or inaccessible — remember the null so we don't retry forever.
		cache.set( id, null );
		notify();
		return null;
	} );
}

export async function listForBlockType( blockType ) {
	if ( listCache.has( blockType ) ) {
		return listCache.get( blockType );
	}
	if ( inflightLists.has( blockType ) ) {
		return inflightLists.get( blockType );
	}
	const promise = apiFetch( {
		path: `/${ window.BVM?.restNamespace ?? 'bvm/v1' }/variations?block_type=${ encodeURIComponent( blockType ) }`,
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
	const path = `/${ window.BVM?.restNamespace ?? 'bvm/v1' }/variations/${ variationId }/instances`;
	const data = await apiFetch( { path } );
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
		path: `/${ window.BVM?.restNamespace ?? 'bvm/v1' }/variations`,
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
		path: `/${ window.BVM?.restNamespace ?? 'bvm/v1' }/variations/${ id }`,
		method: 'PUT',
		data: body,
	} );
	cache.set( data.id, data );
	invalidateList( data.block_type );
	return data;
}
