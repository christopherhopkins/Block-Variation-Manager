export const BVM_ATTR_VARIATION_ID = 'bvmVariationId';
export const BVM_ATTR_OVERRIDES = 'bvmOverriddenAttrs';

// Attributes we should never treat as user-set overrides — they're bookkeeping.
export const INTERNAL_ATTRS = new Set( [
	BVM_ATTR_VARIATION_ID,
	BVM_ATTR_OVERRIDES,
	'className',
	'anchor',
	'lock',
	'metadata',
] );
