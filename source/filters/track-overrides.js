import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import {
	useSyncExternalStore,
	useMemo,
	useCallback,
	useEffect,
	useRef,
} from '@wordpress/element';
import {
	BVM_ATTR_VARIATION_ID,
	BVM_ATTR_OVERRIDES,
	INTERNAL_ATTRS,
} from '../constants.js';
import { deepEqual } from '../lib/equality.js';
import { kadenceClassPair } from '../lib/class-pairs.js';
import {
	subscribe,
	getCached,
	ensureVariationLoaded,
} from '../lib/variation-store.js';

/**
 * Wraps every block's Edit component to:
 *
 * 1. Sync variation → store on mount and when the variation's attrs change.
 *    For each non-overridden variation attr that differs from what's stored,
 *    write the current variation value into the block-editor store. This
 *    makes edits to the source variation propagate into open posts.
 *
 * 2. Track overrides on user edits — wrap setAttributes so that setting an
 *    attr to a value different from the variation marks it overridden;
 *    setting it back to the variation value unmarks it.
 *
 * Why sync-to-store instead of merge-as-prop:
 *   Prop-merging (passing a synthesized `attributes` prop to BlockEdit without
 *   touching the store) makes the displayed values lie to third-party controls
 *   like Kadence's color picker. The picker fires setAttributes in multiple
 *   batched calls (e.g. bgColorClass first, bgColor second). If the merge
 *   shows variation values for attrs the user hasn't touched yet, the block
 *   renders with user-bgColorClass + variation-bgColor until the second batch
 *   lands — looking as if the first click did nothing. Writing real values
 *   into the store keeps all Kadence internal state consistent from the start.
 *
 *   The tradeoff: syncing dirties the post. That's acceptable — if the
 *   variation has genuinely changed since the post was last saved, the user
 *   should save to persist the updated values.
 */
function useVariation( variationId ) {
	useEffect( () => {
		if ( variationId ) {
			ensureVariationLoaded( variationId );
		}
	}, [ variationId ] );

	return useSyncExternalStore(
		subscribe,
		() => ( variationId ? getCached( variationId ) : null )
	);
}

function arraysEqual( a, b ) {
	if ( a.length !== b.length ) return false;
	for ( let i = 0; i < a.length; i++ ) {
		if ( a[ i ] !== b[ i ] ) return false;
	}
	return true;
}

/** Stable identity for "no attrs" — a fresh {} per render would churn the
 * wrappedSetAttributes useCallback (and thus the setAttributes prop) for
 * every unlinked block on every render. */
const EMPTY_ATTRS = {};

const withVariationOverrides = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const { attributes, setAttributes } = props;
		const variationId = attributes?.[ BVM_ATTR_VARIATION_ID ] || 0;
		// undefined = record still loading; null = confirmed missing.
		const variation = useVariation( variationId );
		const variationAttrs = variation?.attrs ?? EMPTY_ATTRS;
		const overriddenList = useMemo(
			() => (
				Array.isArray( attributes?.[ BVM_ATTR_OVERRIDES ] )
					? attributes[ BVM_ATTR_OVERRIDES ]
					: []
			),
			[ attributes ]
		);

		// Keep the latest references reachable from the sync effect without
		// making it re-run on every attribute change. overriddenRef is ALSO
		// updated synchronously inside wrappedSetAttributes: two calls in the
		// same tick share one render's closure, and basing the second call on
		// the stale render-scope list would erase the first call's marks.
		const attributesRef = useRef( attributes );
		attributesRef.current = attributes;
		const overriddenRef = useRef( overriddenList );
		overriddenRef.current = overriddenList;
		const setAttributesRef = useRef( setAttributes );
		setAttributesRef.current = setAttributes;

		// Fingerprint of the variation's attrs — re-sync only when these change,
		// not on every keystroke in the post.
		const variationAttrsKey = useMemo(
			() => ( variation ? JSON.stringify( variationAttrs ) : '' ),
			[ variation, variationAttrs ]
		);

		useEffect( () => {
			if ( ! variationId || ! variation ) return;
			const current = attributesRef.current ?? {};
			const overriddenSet = new Set( overriddenRef.current );
			const update = {};
			for ( const [ key, value ] of Object.entries( variationAttrs ) ) {
				if ( INTERNAL_ATTRS.has( key ) ) continue;
				if ( overriddenSet.has( key ) ) continue;
				if ( ! deepEqual( current[ key ], value ) ) {
					update[ key ] = value;
				}
			}
			// Reconcile marks recorded conservatively while the record was
			// loading (see wrappedSetAttributes): drop entries whose live
			// value matches the variation after all, or that the variation
			// doesn't define — stale marks would wrongly block server-side
			// propagation for this instance.
			const reconciled = Array.from( overriddenSet )
				.filter( ( key ) => {
					if (
						! Object.prototype.hasOwnProperty.call(
							variationAttrs,
							key
						)
					) {
						return false;
					}
					return ! deepEqual(
						current[ key ],
						variationAttrs[ key ]
					);
				} )
				.sort();
			if (
				! arraysEqual( reconciled, [ ...overriddenSet ].sort() )
			) {
				update[ BVM_ATTR_OVERRIDES ] = reconciled;
				overriddenRef.current = reconciled;
			}
			if ( Object.keys( update ).length > 0 ) {
				setAttributesRef.current( update );
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [ variationId, variationAttrsKey ] );

		const wrappedSetAttributes = useCallback(
			( next ) => {
				// null = confirmed missing — nothing to track against.
				if ( ! variationId || variation === null ) {
					setAttributes( next );
					return;
				}
				const changed = { ...next };
				const overrides = new Set( overriddenRef.current );
				const loading = variation === undefined;
				for ( const key of Object.keys( next ) ) {
					if ( INTERNAL_ATTRS.has( key ) ) continue;
					if ( loading ) {
						// The record hasn't arrived yet, so we can't compare
						// values. Mark conservatively — otherwise the sync
						// effect would revert this edit the moment the fetch
						// resolves. The effect's reconcile pass drops marks
						// that turn out to match the variation.
						overrides.add( key );
						continue;
					}
					const hasVariationValue = Object.prototype.hasOwnProperty.call(
						variationAttrs,
						key
					);
					if ( ! hasVariationValue ) {
						continue;
					}
					if ( deepEqual( next[ key ], variationAttrs[ key ] ) ) {
						overrides.delete( key );
						// Un-mark the class-pair sibling too when its live
						// value also matches — marking added them together,
						// so a one-half reset must not strand the other half
						// as a permanent phantom override.
						const pair = kadenceClassPair( key );
						if (
							overrides.has( pair ) &&
							Object.prototype.hasOwnProperty.call(
								variationAttrs,
								pair
							)
						) {
							const pairValue = Object.prototype.hasOwnProperty.call(
								next,
								pair
							)
								? next[ pair ]
								: attributesRef.current?.[ pair ];
							if (
								deepEqual( pairValue, variationAttrs[ pair ] )
							) {
								overrides.delete( pair );
							}
						}
					} else {
						overrides.add( key );
						// Kadence fires bgColor + bgColorClass in separate
						// setAttributes calls. Mark the pair together so the
						// user sees a single consistent override state after
						// the first click instead of half a chip set.
						const pair = kadenceClassPair( key );
						if (
							Object.prototype.hasOwnProperty.call(
								variationAttrs,
								pair
							)
						) {
							overrides.add( pair );
						}
					}
				}
				const newOverrides = Array.from( overrides ).sort();
				if ( ! arraysEqual( newOverrides, overriddenRef.current ) ) {
					changed[ BVM_ATTR_OVERRIDES ] = newOverrides;
					overriddenRef.current = newOverrides;
				}
				setAttributes( changed );
			},
			[ variationId, variation, variationAttrs, setAttributes ]
		);

		return <BlockEdit { ...props } setAttributes={ wrappedSetAttributes } />;
	};
}, 'withVariationOverrides' );

addFilter(
	'editor.BlockEdit',
	'bvm/track-overrides',
	withVariationOverrides
);
