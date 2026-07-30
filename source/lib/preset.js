import { PRESET_EXCLUDED_ATTRS } from '../constants.js';

/**
 * The attrs worth persisting as a variation preset: everything the editor has
 * resolved for the block minus bookkeeping and per-instance identity attrs.
 * Shared by the sidebar Save panel and the variation editor's post-save sync
 * so both write identical shapes.
 */
export function extractPresetAttrs( attributes ) {
	const out = {};
	for ( const [ key, value ] of Object.entries( attributes ) ) {
		if ( PRESET_EXCLUDED_ATTRS.has( key ) ) continue;
		if ( value === undefined ) continue;
		out[ key ] = value;
	}
	return out;
}

/**
 * Recursively shape a tree of editor block objects into the
 * { name, attributes, innerBlocks } payload the REST endpoint stores.
 * Strips excluded attrs and undefined values at every depth.
 */
export function shapeInnerBlocks( blocks ) {
	if ( ! Array.isArray( blocks ) ) return [];
	return blocks
		.filter( ( b ) => b && typeof b.name === 'string' && b.name !== '' )
		.map( ( b ) => ( {
			name: b.name,
			attributes: extractPresetAttrs( b.attributes ?? {} ),
			innerBlocks: shapeInnerBlocks( b.innerBlocks ),
		} ) );
}
