/**
 * Trims the standard WP post-editor chrome on the bvm_variation edit screen
 * so it reads as a "variation editor", not a page editor:
 *
 *   - Removes Document panels that don't apply (Status & visibility,
 *     Permalink, Discussion, Template, Excerpt, Featured image, Page
 *     attributes). Variations have no public URL, no discussion, no
 *     template, no scheduling — surfacing those panels is misleading.
 *   - Repoints the top-left "back to dashboard" link at the variations
 *     list (Tools → Block Variations) instead of the generic admin
 *     dashboard, so the implicit "where does this back arrow go" matches
 *     where the user came from.
 *   - Adds a body class so cosmetic CSS can scope further tweaks.
 *
 * The post title placeholder is NOT handled here: core feeds the block
 * editor's titlePlaceholder through PHP's `enter_title_here` filter, which
 * CPT::title_placeholder hooks — no DOM mutation required (the old
 * MutationObserver also could not reach the title once the editor moved it
 * inside the canvas iframe).
 */

import { __ } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';

const PANELS_TO_REMOVE = [
	'post-status',
	'post-link',
	'discussion-panel',
	'template',
	'page-attributes',
	'post-excerpt',
	'featured-image',
];

export function applyVariationEditorChrome() {
	document.body.classList.add( 'is-bvm-variation-editor' );

	// removeEditorPanel moved from core/edit-post to core/editor in WP 6.5.
	// Prefer the new namespace; fall back to the old one for older builds.
	const editor = dispatch( 'core/editor' );
	const editPost = dispatch( 'core/edit-post' );
	const remove =
		editor?.removeEditorPanel?.bind( editor ) ??
		editPost?.removeEditorPanel?.bind( editPost );
	if ( remove ) {
		PANELS_TO_REMOVE.forEach( ( name ) => remove( name ) );
	}

	observeBackLink();
}

/**
 * The top-left "W" / fullscreen-close affordance is rendered by core as an
 * anchor in fullscreen mode; when fullscreen is off (per-user preference) it
 * doesn't exist at all, and some builds render it as a <button>.
 *
 * We retarget the anchor at the variations list. Crucially the observer
 * disconnects as soon as the element is FOUND — whatever its tag (a button
 * will never become an anchor) — and times out entirely if it never appears,
 * instead of running a document-wide querySelector on every DOM mutation for
 * the rest of the session.
 */
function observeBackLink() {
	const url = window.BVM?.variationListUrl;
	if ( ! url ) return;

	const apply = () => {
		const el = document.querySelector(
			'.edit-post-fullscreen-mode-close, .editor-document-tools__back'
		);
		if ( ! el ) return false;
		if ( 'A' === el.tagName ) {
			el.setAttribute( 'href', url );
			el.setAttribute(
				'aria-label',
				__( 'Block Variations', 'block-variation-manager' )
			);
		}
		return true;
	};

	if ( apply() ) return;
	const observer = new MutationObserver( () => {
		if ( apply() ) observer.disconnect();
	} );
	observer.observe( document.body, { childList: true, subtree: true } );
	setTimeout( () => observer.disconnect(), 10000 );
}
