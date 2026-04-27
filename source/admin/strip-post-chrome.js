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
 *   - Replaces the post title placeholder ("Add title") with
 *     "Variation name" via a MutationObserver — the post title input is
 *     rendered by core and its placeholder isn't filterable.
 *
 * Implemented with DOM mutation rather than SlotFill so we don't pull in
 * @wordpress/interface (a bundled-by-default WP package; importing it
 * forces a node_modules install and inflates the bundle).
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

	observeTitlePlaceholder();
	observeBackLink();
}

function observeTitlePlaceholder() {
	const apply = () => {
		const el = document.querySelector(
			'.editor-post-title__input, .wp-block-post-title'
		);
		if ( ! el ) return false;
		el.setAttribute(
			'placeholder',
			__( 'Variation name', 'block-variation-manager' )
		);
		el.setAttribute(
			'aria-label',
			__( 'Variation name', 'block-variation-manager' )
		);
		return true;
	};

	if ( apply() ) return;
	// One-shot observer — disconnect as soon as we hit the title once.
	const observer = new MutationObserver( () => {
		if ( apply() ) observer.disconnect();
	} );
	observer.observe( document.body, { childList: true, subtree: true } );
}

/**
 * The top-left "W" / fullscreen-close button is rendered by core as an
 * anchor pointing at admin URL or a dispatch-driven button. Across recent
 * Gutenberg versions the selector has been any of:
 *
 *   .edit-post-fullscreen-mode-close
 *   .editor-document-tools__back
 *
 * We point both at the variations list and add a tooltip label.
 */
function observeBackLink() {
	const url = window.BVM?.variationListUrl;
	if ( ! url ) return;

	const apply = () => {
		const el = document.querySelector(
			'.edit-post-fullscreen-mode-close, .editor-document-tools__back'
		);
		// Some implementations render the back affordance as a <button>;
		// only mutate when it's an anchor we can safely retarget.
		if ( ! el || 'A' !== el.tagName ) return false;
		el.setAttribute( 'href', url );
		el.setAttribute(
			'aria-label',
			__( 'Block Variations', 'block-variation-manager' )
		);
		return true;
	};

	if ( apply() ) return;
	const observer = new MutationObserver( () => {
		if ( apply() ) observer.disconnect();
	} );
	observer.observe( document.body, { childList: true, subtree: true } );
}
