import {
	BVM_ATTR_VARIATION_ID,
	PRESET_EXCLUDED_ATTRS,
} from '../constants.js';

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
 *
 * Linked children (§9.16): a child that is itself a variation instance is
 * opaque to the enclosing template — capture only its link. Its settings
 * come from its own variation at render/editor time; baking them here would
 * fork a stale copy that fights the live values. This is the one deliberate
 * exception to the PRESET_EXCLUDED_ATTRS strip.
 */
export function shapeInnerBlocks( blocks ) {
	if ( ! Array.isArray( blocks ) ) return [];
	return blocks
		.filter( ( b ) => b && typeof b.name === 'string' && b.name !== '' )
		.map( ( b ) => {
			const linkedId =
				parseInt( b.attributes?.[ BVM_ATTR_VARIATION_ID ], 10 ) || 0;
			if ( linkedId > 0 ) {
				return {
					name: b.name,
					attributes: { [ BVM_ATTR_VARIATION_ID ]: linkedId },
					innerBlocks: shapeInnerBlocks( b.innerBlocks ),
				};
			}
			return {
				name: b.name,
				attributes: extractPresetAttrs( b.attributes ?? {} ),
				innerBlocks: shapeInnerBlocks( b.innerBlocks ),
			};
		} );
}
