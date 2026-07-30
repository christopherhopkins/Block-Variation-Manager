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

// Attributes that must never enter a variation preset: the bookkeeping set
// above plus per-instance identity attrs (Kadence's uniqueID drives its
// request-time CSS selectors — sharing one across instances breaks styling).
// Mirrors Attributes::excluded_attrs() on the PHP side.
export const PRESET_EXCLUDED_ATTRS = new Set( [
	...INTERNAL_ATTRS,
	'uniqueID',
	'uniqueId',
] );
