import { __, sprintf, _n } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';
import { PluginDocumentSettingPanel } from '@wordpress/editor';
import { useSelect } from '@wordpress/data';
import { useState, useEffect } from '@wordpress/element';
import {
	Button,
	Spinner,
	__experimentalText as Text,
} from '@wordpress/components';
import { listInstances } from '../lib/variation-store.js';
import { ORIENTATION_STORAGE_KEY, dispatchOrientationNotice } from './orientation.js';

const VARIATION_CPT = 'bvm_variation';

function UsagePanel() {
	const postId = useSelect(
		( s ) => s( 'core/editor' )?.getCurrentPostId?.(),
		[]
	);
	const postType = useSelect(
		( s ) => s( 'core/editor' )?.getCurrentPostType?.(),
		[]
	);
	const [ instances, setInstances ] = useState( null );
	const [ error, setError ] = useState( null );

	useEffect( () => {
		if ( ! postId || postType !== VARIATION_CPT ) return;
		let cancelled = false;
		listInstances( postId )
			.then( ( data ) => {
				if ( ! cancelled ) setInstances( data );
			} )
			.catch( ( err ) => {
				if ( ! cancelled ) setError( err.message || String( err ) );
			} );
		return () => {
			cancelled = true;
		};
	}, [ postId, postType ] );

	if ( postType !== VARIATION_CPT ) return null;

	return (
		<PluginDocumentSettingPanel
			name="bvm-usage"
			title={ __( 'Usage', 'block-variation-manager' ) }
			className="bvm-usage-panel"
		>
			{ error && (
				<Text as="p" variant="muted" size="12">
					{ error }
				</Text>
			) }
			{ instances === null && ! error && <Spinner /> }
			{ Array.isArray( instances ) && instances.length === 0 && (
				<Text as="p" variant="muted" size="12">
					{ __(
						'Not used on any pages yet.',
						'block-variation-manager'
					) }
				</Text>
			) }
			{ Array.isArray( instances ) && instances.length > 0 && (
				<>
					<Text
						as="p"
						size="12"
						weight="600"
						style={ { marginBottom: 6 } }
					>
						{ sprintf(
							/* translators: %d: number of pages */
							_n(
								'Used on %d page',
								'Used on %d pages',
								instances.length,
								'block-variation-manager'
							),
							instances.length
						) }
					</Text>
					<ul
						style={ {
							margin: 0,
							padding: 0,
							listStyle: 'none',
						} }
					>
						{ instances.map( ( item ) => (
							<li
								key={ item.id }
								style={ {
									padding: '4px 0',
									borderBottom:
										'1px solid rgba(0,0,0,0.06)',
								} }
							>
								<a
									href={ item.edit_link || '#' }
									target="_blank"
									rel="noopener noreferrer"
								>
									{ item.title }
								</a>
								<Text
									as="span"
									size="11"
									variant="muted"
									style={ { marginLeft: 6 } }
								>
									{ item.post_type }
									{ 'publish' !== item.status &&
										` · ${ item.status }` }
								</Text>
							</li>
						) ) }
					</ul>
				</>
			) }

			<hr style={ { margin: '12px 0' } } />

			<Text as="p" size="11" weight="600" upperCase>
				{ __( 'About this screen', 'block-variation-manager' ) }
			</Text>
			<Text as="p" variant="muted" size="12" style={ { marginTop: 4 } }>
				{ __(
					'Saving propagates to every instance above, except attributes overridden on a specific block.',
					'block-variation-manager'
				) }
			</Text>
			<Button
				variant="link"
				onClick={ () => {
					try {
						window.localStorage.removeItem( ORIENTATION_STORAGE_KEY );
					} catch ( _e ) {
						// localStorage unavailable — fine, just re-fire.
					}
					dispatchOrientationNotice(
						window.BVM?.variationUsageCount ?? 0
					);
				} }
				style={ { paddingLeft: 0 } }
			>
				{ __( 'Show orientation banner', 'block-variation-manager' ) }
			</Button>
		</PluginDocumentSettingPanel>
	);
}

registerPlugin( 'bvm-usage', {
	render: UsagePanel,
} );
