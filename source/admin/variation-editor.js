/**
 * Runs only on the bvm_variation post edit screen.
 *
 * Enforces "exactly one root block of the variation's block type" while
 * leaving inner blocks fully editable — so the user can build nested
 * structures inside the variation. The root block's attributes are what
 * propagate to every instance; inner blocks ride along as a template
 * that pre-populates each instance on insert (instance-local after that).
 *
 * Enforcement is purely client-side (no root templateLock) because a
 * server-side root templateLock cascades into inner blocks and defeats
 * the point.
 *
 * Also:
 * - Shows a dismissible orientation banner (see ./orientation.js).
 * - Mounts a Document sidebar panel listing every page using this
 *   variation (see ./usage-panel.js).
 */

import { dispatch, select, subscribe } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import domReady from '@wordpress/dom-ready';
import { dispatchOrientationNotice } from './orientation.js';
import './usage-panel.js';

const ctx = window.BVM ?? {};

if ( ctx.isVariationEditor && ctx.variationBlockType ) {
	domReady( () => {
		initVariationEditor( ctx.variationBlockType );
		dispatchOrientationNotice( ctx.variationUsageCount || 0 );
	} );
}

function initVariationEditor( blockType ) {
	let reentrant = false;

	subscribe( () => {
		// IMPORTANT: @wordpress/data fires subscribers synchronously
		// inside dispatch(). resetBlocks() below would re-enter this
		// callback and blow the stack without this guard.
		if ( reentrant ) return;

		const blockEditor = select( 'core/block-editor' );
		if ( ! blockEditor ) return;

		const blocks = blockEditor.getBlocks();

		// Re-seed an empty editor. Happens on first load of a brand-new
		// variation, and also if the user somehow deletes the root block.
		if ( blocks.length === 0 ) {
			reentrant = true;
			try {
				dispatch( 'core/block-editor' ).resetBlocks( [
					createBlock( blockType ),
				] );
			} finally {
				reentrant = false;
			}
			return;
		}

		// Prune any stray root siblings. Keeps exactly one root block of
		// the configured type. Wrong-type roots are replaced; extra roots
		// are dropped (inner blocks of the kept root are preserved).
		const first = blocks[ 0 ];
		const extraRoots = blocks.length > 1;
		const wrongType = first.name !== blockType;
		if ( extraRoots || wrongType ) {
			reentrant = true;
			try {
				const kept =
					wrongType ? createBlock( blockType ) : first;
				dispatch( 'core/block-editor' ).resetBlocks( [ kept ] );
			} finally {
				reentrant = false;
			}
		}
	} );
}
