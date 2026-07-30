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
import { applyVariationEditorChrome } from './strip-post-chrome.js';
import { updateVariation } from '../lib/variation-store.js';
import { extractPresetAttrs, shapeInnerBlocks } from '../lib/preset.js';
import './usage-panel.js';

const ctx = window.BVM ?? {};

if ( ctx.isVariationEditor && ctx.variationBlockType ) {
	domReady( () => {
		applyVariationEditorChrome();
		initVariationEditor( ctx.variationBlockType );
		initAttrsSaveSync( ctx.variationBlockType );
		dispatchOrientationNotice( ctx.variationUsageCount || 0 );
	} );
}

function findSourceBlock( blocks, name ) {
	for ( const b of blocks ) {
		if ( b.name === name ) return b;
		const found = findSourceBlock( b.innerBlocks ?? [], name );
		if ( found ) return found;
	}
	return null;
}

/**
 * After each successful editor save of the variation post, push the source
 * block's fully-resolved attributes (and inner tree) into the variation's
 * meta via PUT /bvm/v1/variations/:id.
 *
 * Why: the server-side save sync can only parse comment-serialized attrs,
 * which lose html-sourced values (heading/button text) and client-registered
 * defaults (Kadence presets). The editor holds the resolved values, so it is
 * the authority — this refresh keeps those keys in the preset (which is what
 * lets instances mark text edits as overrides) and purges stale keys the
 * server-side baseline would otherwise carry forward. The server treats an
 * attrs-only PUT as meta-only (no post_content rewrite), so this cannot loop
 * back into another save.
 */
function initAttrsSaveSync( blockType ) {
	let wasSaving = false;
	subscribe( () => {
		const editor = select( 'core/editor' );
		if ( ! editor ) return;
		const isSaving =
			( editor.isSavingPost?.() ?? false ) &&
			! ( editor.isAutosavingPost?.() ?? false );
		const justFinished = wasSaving && ! isSaving;
		wasSaving = isSaving;
		if ( ! justFinished || ! editor.didPostSaveRequestSucceed?.() ) {
			return;
		}
		const postId = editor.getCurrentPostId?.();
		if ( ! postId ) return;
		const source = findSourceBlock(
			select( 'core/block-editor' )?.getBlocks?.() ?? [],
			blockType
		);
		if ( ! source ) return;
		updateVariation( postId, {
			attrs: extractPresetAttrs( source.attributes ?? {} ),
			innerBlocks: shapeInnerBlocks( source.innerBlocks ?? [] ),
		} ).catch( () => {
			// Non-fatal: the server-side parse sync already stored a
			// baseline; the next successful save refreshes it.
		} );
	} );
}

function initVariationEditor( blockType ) {
	// Child-only block types (block.json `parent`) are legitimately stored
	// inside synthetic parent wrapper(s) — see Rest::wrap_for_editing. The
	// expected ROOT is therefore the outermost wrapper, not the block type
	// itself. Enforcing against the raw block type here used to destroy
	// child-only variations on open.
	const chain =
		Array.isArray( ctx.variationRootChain ) && ctx.variationRootChain.length
			? ctx.variationRootChain
			: [ blockType ];
	const expectedRoot = chain[ 0 ];
	const seedChain = () =>
		chain.reduceRight(
			( inner, name ) => [ createBlock( name, {}, inner ) ],
			[]
		);

	let reentrant = false;

	subscribe( () => {
		// IMPORTANT: @wordpress/data fires subscribers synchronously
		// inside dispatch(). resetBlocks() below would re-enter this
		// callback and blow the stack without this guard.
		if ( reentrant ) return;

		const blockEditor = select( 'core/block-editor' );
		if ( ! blockEditor ) return;

		// During boot getBlocks() is transiently [] before the saved content
		// is parsed into the store; enforcing then would seed a stray block
		// and dirty the post. Wait until the editor reports ready (selector
		// is unstable — fall through when absent on older cores).
		const editorStore = select( 'core/editor' );
		if (
			editorStore?.__unstableIsEditorReady &&
			! editorStore.__unstableIsEditorReady()
		) {
			return;
		}

		const blocks = blockEditor.getBlocks();

		// Re-seed an empty editor. Happens on first load of a brand-new
		// variation, and also if the user somehow deletes the root block.
		if ( blocks.length === 0 ) {
			reentrant = true;
			try {
				dispatch( 'core/block-editor' ).resetBlocks( seedChain() );
			} finally {
				reentrant = false;
			}
			return;
		}

		// Prune any stray root siblings. Keeps exactly one root of the
		// expected wrapper type. Wrong-type roots are replaced with a fresh
		// seeded chain; extra roots are dropped (inner blocks of the kept
		// root are preserved).
		const first = blocks[ 0 ];
		const extraRoots = blocks.length > 1;
		const wrongType = first.name !== expectedRoot;
		if ( extraRoots || wrongType ) {
			reentrant = true;
			try {
				const kept = wrongType ? seedChain() : [ first ];
				dispatch( 'core/block-editor' ).resetBlocks( kept );
			} finally {
				reentrant = false;
			}
		}
	} );
}
