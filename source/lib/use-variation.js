import { useEffect, useSyncExternalStore } from '@wordpress/element';
import { subscribe, getCached, ensureVariationLoaded } from './variation-store.js';

/**
 * The one shared "subscribe to a variation record" hook (QUA-20 — it was
 * duplicated in track-overrides and VariationPanel). Returns the store's
 * tri-state snapshot: undefined = loading, null = confirmed missing,
 * object = loaded (§9.12).
 */
export function useVariationSnapshot( variationId ) {
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
