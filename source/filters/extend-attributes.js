import { addFilter } from '@wordpress/hooks';
import { BVM_ATTR_VARIATION_ID, BVM_ATTR_OVERRIDES } from '../constants.js';

/**
 * Mirror of the PHP register_block_type_args extension: add bvmVariationId
 * and bvmOverriddenAttrs to every block's attribute schema on the client,
 * so the editor knows how to serialize/deserialize them.
 */
function extendBlockAttributes( settings ) {
	if ( ! settings.attributes ) {
		settings.attributes = {};
	}
	if ( ! settings.attributes[ BVM_ATTR_VARIATION_ID ] ) {
		settings.attributes[ BVM_ATTR_VARIATION_ID ] = {
			type: 'number',
			default: 0,
		};
	}
	if ( ! settings.attributes[ BVM_ATTR_OVERRIDES ] ) {
		settings.attributes[ BVM_ATTR_OVERRIDES ] = {
			type: 'array',
			default: [],
			items: { type: 'string' },
		};
	}
	return settings;
}

addFilter(
	'blocks.registerBlockType',
	'bvm/extend-attributes',
	extendBlockAttributes
);
