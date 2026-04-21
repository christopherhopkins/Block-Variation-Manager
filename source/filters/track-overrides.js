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

/**
 * Kadence (and some other WP block libs) store color-like attributes as a
 * pair: `fooColor` holds the palette slug/hex, `fooColorClass` holds the CSS
 * class. User interactions in the color picker often fire the two halves in
 * separate setAttributes calls. Without pairing, the first call marks only
 * one half as overridden — confusing for the user.
 *
 * Given an attr name, return any variation-controlled "class pair" siblings
 * that should move together with it.
 */
function kadenceClassPair( key ) {
	if ( key.endsWith( 'Class' ) && key.length > 5 ) {
		return key.slice( 0, -5 );
	}
	return key + 'Class';
}

const withVariationOverrides = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const { attributes, setAttributes } = props;
		const variationId = attributes?.[ BVM_ATTR_VARIATION_ID ] || 0;
		const variation = useVariation( variationId );
		const variationAttrs = variation?.attrs ?? {};
		const overriddenList = useMemo(
			() => (
				Array.isArray( attributes?.[ BVM_ATTR_OVERRIDES ] )
					? attributes[ BVM_ATTR_OVERRIDES ]
					: []
			),
			[ attributes ]
		);

		// Keep the latest references reachable from the sync effect without
		// making it re-run on every attribute change.
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
			if ( Object.keys( update ).length > 0 ) {
				setAttributesRef.current( update );
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [ variationId, variationAttrsKey ] );

		const wrappedSetAttributes = useCallback(
			( next ) => {
				if ( ! variationId || ! variation ) {
					setAttributes( next );
					return;
				}
				const changed = { ...next };
				const overrides = new Set( overriddenList );
				for ( const key of Object.keys( next ) ) {
					if ( INTERNAL_ATTRS.has( key ) ) continue;
					const hasVariationValue = Object.prototype.hasOwnProperty.call(
						variationAttrs,
						key
					);
					if ( ! hasVariationValue ) {
						continue;
					}
					if ( deepEqual( next[ key ], variationAttrs[ key ] ) ) {
						overrides.delete( key );
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
				if ( ! arraysEqual( newOverrides, overriddenList ) ) {
					changed[ BVM_ATTR_OVERRIDES ] = newOverrides;
				}
				setAttributes( changed );
			},
			[ variationId, variation, variationAttrs, overriddenList, setAttributes ]
		);

		return <BlockEdit { ...props } setAttributes={ wrappedSetAttributes } />;
	};
}, 'withVariationOverrides' );

addFilter(
	'editor.BlockEdit',
	'bvm/track-overrides',
	withVariationOverrides
);
