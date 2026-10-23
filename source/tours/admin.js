/**
 * Webpack entry for the Tools → Block Variations list screen: the
 * management-screen onboarding tour and its "Start tour" relaunch button.
 * Enqueued by BVM\Tours::enqueue_admin on `edit-bvm_variation` only.
 */
import domReady from '@wordpress/dom-ready';
import { __ } from '@wordpress/i18n';

import 'driver.js/dist/driver.css';
import './tour.scss';
import { initTourState, autoStartTour, launchTour } from './state.js';

/** Completion-map key of the management-screen tour (see BVM\Tours). */
export const MANAGEMENT_TOUR_ID = 'management';

/**
 * Declarative steps for the management-screen tour. A function, not a
 * constant, so translations resolve at call time. Anchors that are absent
 * (e.g. no rows yet) are skipped by the engine.
 */
export function managementTourSteps() {
	return [
		{
			title: __( 'Welcome to Block Variations', 'block-variation-manager' ),
			description: __(
				'A variation saves a block’s settings under a name. Every block linked to it stays in sync site-wide, while each page keeps its own content and manual tweaks.',
				'block-variation-manager'
			),
		},
		{
			element: '.wp-list-table',
			title: __( 'Your variations', 'block-variation-manager' ),
			description: __(
				'Every saved variation lives here. Click a title to edit its settings — changes propagate to all linked blocks.',
				'block-variation-manager'
			),
		},
		{
			element: '.manage-column.column-bvm_block_type',
			title: __( 'Block type', 'block-variation-manager' ),
			description: __(
				'Each variation belongs to one block type. It can only be applied to blocks of this type.',
				'block-variation-manager'
			),
		},
		{
			element: '.manage-column.column-bvm_usage',
			title: __( 'Usage', 'block-variation-manager' ),
			description: __(
				'How many pages use this variation. Editing a widely-used variation updates all of them.',
				'block-variation-manager'
			),
		},
		{
			element: '#the-list tr:first-child',
			title: __( 'Manage a variation', 'block-variation-manager' ),
			description: __(
				'Hover a row for quick actions: edit the variation or move it to the trash. Trashing a variation detaches its blocks without deleting content.',
				'block-variation-manager'
			),
		},
		{
			element: '.page-title-action',
			title: __( 'Create a variation', 'block-variation-manager' ),
			description: __(
				'Start a variation from scratch here — or select any block in the editor and use its Variation panel to save the block as a variation.',
				'block-variation-manager'
			),
		},
	];
}

/**
 * Mount the "Start tour" button and auto-start the tour once per user.
 *
 * @return {boolean} Whether the list screen was found and wired.
 */
export function initManagementTour() {
	const heading = document.querySelector( 'h1.wp-heading-inline' );
	if ( ! heading ) {
		return false;
	}
	if ( document.querySelector( 'button.bvm-tour-start' ) ) {
		return true;
	}

	initTourState( window.BVMTours?.completed );

	const tour = { id: MANAGEMENT_TOUR_ID, steps: managementTourSteps() };

	const button = document.createElement( 'button' );
	button.type = 'button';
	button.className = 'page-title-action bvm-tour-start';
	button.textContent = __( 'Start tour', 'block-variation-manager' );
	button.addEventListener( 'click', () =>
		launchTour( { id: MANAGEMENT_TOUR_ID, steps: managementTourSteps() } )
	);

	const anchor =
		document.querySelector( 'a.page-title-action' ) ?? heading;
	anchor.insertAdjacentElement( 'afterend', button );

	autoStartTour( tour );
	return true;
}

domReady( () => initManagementTour() );
