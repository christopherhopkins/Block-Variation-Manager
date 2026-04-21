import { __, sprintf, _n } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';

export const ORIENTATION_STORAGE_KEY = 'bvm-orientation-seen';
const NOTICE_ID = 'bvm-orientation';

function readDismissed() {
	try {
		return window.localStorage.getItem( ORIENTATION_STORAGE_KEY ) === '1';
	} catch ( _e ) {
		return false;
	}
}

function writeDismissed() {
	try {
		window.localStorage.setItem( ORIENTATION_STORAGE_KEY, '1' );
	} catch ( _e ) {
		// ignore — the notice simply reappears next load
	}
}

/**
 * Show the variation-editor orientation banner. Dismissible; dismissal
 * persists in localStorage so agency devs don't re-read the same sentence
 * every time they open a variation.
 */
export function dispatchOrientationNotice( usageCount ) {
	const notices = dispatch( 'core/notices' );
	if ( ! notices?.createNotice ) return;

	// Remove any previously-shown copy so re-surfacing replaces it.
	notices.removeNotice?.( NOTICE_ID );

	if ( readDismissed() ) return;

	const usage =
		usageCount > 0
			? sprintf(
					/* translators: %d: number of pages using this variation */
					_n(
						'Used on %d page.',
						'Used on %d pages.',
						usageCount,
						'block-variation-manager'
					),
					usageCount
			  )
			: __( 'Not used yet.', 'block-variation-manager' );

	const explain = __(
		'Saving updates every instance of this variation, except attributes overridden on a specific block.',
		'block-variation-manager'
	);

	notices.createNotice( 'info', `${ usage } ${ explain }`, {
		id: NOTICE_ID,
		isDismissible: true,
		type: 'default',
		onDismiss: writeDismissed,
	} );
}
