import { driver } from 'driver.js';

/**
 * Thin declarative wrapper around driver.js.
 *
 * A tour is a list of steps: `{ element?, title, description }`. Steps with
 * an `element` selector anchor a spotlight popover to that node; steps
 * without one render as a centered modal step. Steps whose anchor is not in
 * the DOM are skipped, so one definition serves screens in different states
 * (e.g. "apply a variation" only shows when a variation exists).
 */

export function prefersReducedMotion() {
	if ( typeof window.matchMedia !== 'function' ) {
		return false;
	}
	return window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
}

/**
 * Resolve declarative steps against the current DOM into driver.js steps.
 *
 * @param {Array<{element?: string, title: string, description: string}>} steps
 * @return {Array<Object>} driver.js step configs, missing anchors dropped.
 */
export function resolveSteps( steps ) {
	const out = [];
	for ( const step of steps ) {
		const { element, title, description } = step;
		if ( element && ! document.querySelector( element ) ) {
			continue;
		}
		const resolved = { popover: { title, description } };
		if ( element ) {
			resolved.element = element;
		}
		out.push( resolved );
	}
	return out;
}

/**
 * Build a driver.js tour from a declarative config.
 *
 * @param {Object}   config
 * @param {Array}    config.steps    Declarative steps (see resolveSteps).
 * @param {Function} [config.onFinish] Called once when the tour is destroyed —
 *                                     finishing and dismissing (X / Esc /
 *                                     overlay click) both count, since either
 *                                     way the user has seen the tour.
 * @return {Object|null} driver.js instance, or null when no step resolves.
 */
export function createTour( { steps, onFinish } ) {
	const resolved = resolveSteps( steps );
	if ( ! resolved.length ) {
		return null;
	}
	return driver( {
		steps: resolved,
		popoverClass: 'bvm-tour',
		showProgress: true,
		animate: ! prefersReducedMotion(),
		// Completion is wired through onDestroyStarted, NOT onDestroyed:
		// driver.js only fires onDestroyed once a step highlight has fully
		// transitioned (__activeStep set), so a dismissal during the opening
		// animation would silently skip it and the tour would auto-start
		// again forever (TECHNICAL.md §9.21). onDestroyStarted fires on every
		// user-initiated close/finish; d.destroy() then skips the hook.
		onDestroyStarted: ( _el, _step, { driver: d } ) => {
			onFinish?.();
			d.destroy();
		},
	} );
}

/**
 * Create and immediately start a tour.
 *
 * @param {Object} config See createTour.
 * @return {boolean} Whether a tour was shown.
 */
export function startTour( config ) {
	const tour = createTour( config );
	if ( ! tour ) {
		return false;
	}
	tour.drive();
	return true;
}
