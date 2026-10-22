import apiFetch from '@wordpress/api-fetch';

import { startTour } from './engine.js';

/** Mirrors BVM\Tours::META_KEY — the user-meta map of tourId => true. */
export const TOURS_META_KEY = 'bvm_tours_completed';

let completed = {};

/**
 * Seed the completion cache from localized data (one per page load; the
 * server localizes the current user's map at enqueue time, so no read
 * request is needed).
 *
 * @param {Object<string,boolean>|undefined} seed
 */
export function initTourState( seed ) {
	completed = { ...( seed || {} ) };
}

/**
 * @param {string} tourId
 * @return {boolean} Whether the user has finished/dismissed this tour.
 */
export function hasCompleted( tourId ) {
	return Boolean( completed[ tourId ] );
}

/**
 * Mark a tour completed: optimistically in the local cache, persisted via
 * the core users endpoint. Persistence failures are swallowed — the only
 * cost is the tour auto-starting again on another device.
 *
 * @param {string} tourId
 * @return {Promise<void>}
 */
export function markCompleted( tourId ) {
	if ( hasCompleted( tourId ) ) {
		return Promise.resolve();
	}
	completed = { ...completed, [ tourId ]: true };
	return apiFetch( {
		path: '/wp/v2/users/me',
		method: 'POST',
		data: { meta: { [ TOURS_META_KEY ]: completed } },
	} ).then(
		() => undefined,
		() => undefined
	);
}

/**
 * Start a tour unconditionally (the "Start tour" buttons). Finishing or
 * dismissing it marks it completed so it stops auto-starting.
 *
 * @param {Object} tour `{ id, steps }`
 * @return {boolean} Whether the tour was shown.
 */
export function launchTour( { id, steps } ) {
	return startTour( {
		steps,
		onFinish: () => markCompleted( id ),
	} );
}

/**
 * Start a tour only if this user has never completed/dismissed it.
 *
 * @param {Object} tour `{ id, steps }`
 * @return {boolean} Whether the tour was shown.
 */
export function autoStartTour( tour ) {
	if ( hasCompleted( tour.id ) ) {
		return false;
	}
	return launchTour( tour );
}
