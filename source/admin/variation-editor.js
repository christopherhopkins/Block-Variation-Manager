/**
 * Runs only on the bvm_variation post edit screen.
 *
 * - Seeds the correct block type if the editor is empty.
 * - Locks the root template so the user can't add sibling blocks.
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
	let seededOnce = false;
	let lockedOnce = false;

	subscribe( () => {
		const blockEditor = select( 'core/block-editor' );
		if ( ! blockEditor ) return;

		const blocks = blockEditor.getBlocks();

		// IMPORTANT: set flags before dispatch — @wordpress/data fires
		// subscribers synchronously inside dispatch(), so without the
		// early flag this callback re-enters and the stack blows.

		if ( ! seededOnce && blocks.length === 0 ) {
			seededOnce = true;
			const newBlock = createBlock( blockType );
			dispatch( 'core/block-editor' ).resetBlocks( [ newBlock ] );
			return;
		}

		if ( blocks.length > 0 ) {
			seededOnce = true;
		}

		if ( ! lockedOnce && blocks.length > 0 ) {
			lockedOnce = true;
			const template = blocks.map( ( b ) => [ b.name, b.attributes ] );
			const updateSettings =
				dispatch( 'core/block-editor' )?.updateSettings;
			if ( typeof updateSettings === 'function' ) {
				updateSettings( {
					template,
					templateLock: 'all',
				} );
			}
		}
	} );
}
