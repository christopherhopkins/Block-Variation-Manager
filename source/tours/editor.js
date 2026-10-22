import { __ } from '@wordpress/i18n';

import { autoStartTour, launchTour } from './state.js';

/**
 * Block-editor tour of the Variation panel. State is seeded once per page
 * load in entry.js (initTourState from the localized BVM.toursCompleted).
 */
export const EDITOR_TOUR_ID = 'editor-panel';

/** Declarative steps; function so translations resolve at call time. */
export function editorTourSteps() {
	return [
		{
			title: __( 'Variations in the editor', 'block-variation-manager' ),
			description: __(
				'Every compatible block gets a Variation panel in its sidebar. Here’s the 60-second workflow.',
				'block-variation-manager'
			),
		},
		{
			element: '.bvm-save-variation-panel',
			title: __( 'Save as variation', 'block-variation-manager' ),
			description: __(
				'Style a block the way you want, name it here, and save. The block’s settings become the variation’s defaults, and this block links to it.',
				'block-variation-manager'
			),
		},
		{
			element: '.bvm-variation-source-panel',
			title: __( 'Apply a variation', 'block-variation-manager' ),
			description: __(
				'Link this block to an existing variation with the Apply dropdown. Edits to the variation then propagate here automatically.',
				'block-variation-manager'
			),
		},
		{
			element: '.bvm-variation-source-panel',
			title: __( 'Overrides are yours', 'block-variation-manager' ),
			description: __(
				'Change any setting on a linked block and it becomes a per-instance override — shown as chips here, never clobbered by the variation. Click a chip to reset it.',
				'block-variation-manager'
			),
		},
		{
			element: '.bvm-variation-source-panel',
			title: __( 'Unlink anytime', 'block-variation-manager' ),
			description: __(
				'More → Unlink detaches the block: it keeps its current look but stops receiving variation updates.',
				'block-variation-manager'
			),
		},
	];
}

/** Relaunch from the "Take the tour" link — always runs. */
export function startEditorTour() {
	return launchTour( { id: EDITOR_TOUR_ID, steps: editorTourSteps() } );
}

/**
 * Auto-start once per user, but only when the Variation panel is actually
 * on screen — with the sidebar closed the anchored steps would all be
 * skipped and the welcome popover would float over nothing. Not finding
 * the panel leaves the tour unseen, so a later selection retries.
 *
 * @return {boolean} Whether the tour was shown.
 */
export function maybeAutoStartEditorTour() {
	if ( ! document.querySelector( '.bvm-variation-source-panel' ) ) {
		return false;
	}
	return autoStartTour( { id: EDITOR_TOUR_ID, steps: editorTourSteps() } );
}
