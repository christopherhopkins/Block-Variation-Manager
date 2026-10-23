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

/** Tour of the variation-editor screen (editing a bvm_variation post). */
export const VARIATION_EDITOR_TOUR_ID = 'variation-editor';

/** Declarative steps for the variation-editor screen tour (translations resolve at call time). */
export function variationEditorTourSteps() {
	return [
		{
			title: __( 'This is a variation source', 'block-variation-manager' ),
			description: __(
				'You’re editing the variation itself, not a page. The single block below holds the settings every linked block inherits.',
				'block-variation-manager'
			),
		},
		{
			element: '.editor-post-title',
			title: __( 'Variation name', 'block-variation-manager' ),
			description: __(
				'The name editors pick from the Apply dropdown. Keep it recognizable — renaming is safe and changes nothing on pages.',
				'block-variation-manager'
			),
		},
		{
			element: '.bvm-usage-panel',
			title: __( 'Usage', 'block-variation-manager' ),
			description: __(
				'Every page using this variation is listed here. Saving propagates your changes to all of them — except attributes a page has overridden.',
				'block-variation-manager'
			),
		},
		{
			title: __( 'One root block', 'block-variation-manager' ),
			description: __(
				'A variation holds exactly one root block of its type (inner blocks are fine). Edit it freely, then Update to publish the change everywhere.',
				'block-variation-manager'
			),
		},
	];
}

/** Relaunch from the usage panel's "Take the tour" link — always runs. */
export function startVariationEditorTour() {
	return launchTour( {
		id: VARIATION_EDITOR_TOUR_ID,
		steps: variationEditorTourSteps(),
	} );
}

/**
 * Auto-start once per user on the variation editor, gated on the localized
 * screen flag and the usage panel having rendered.
 *
 * @return {boolean} Whether the tour was shown.
 */
export function maybeAutoStartVariationEditorTour() {
	if ( ! window.BVM?.isVariationEditor ) {
		return false;
	}
	if ( ! document.querySelector( '.bvm-usage-panel' ) ) {
		return false;
	}
	return autoStartTour( {
		id: VARIATION_EDITOR_TOUR_ID,
		steps: variationEditorTourSteps(),
	} );
}
