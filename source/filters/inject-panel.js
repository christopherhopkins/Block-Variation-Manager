import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { Fragment } from '@wordpress/element';
import VariationPanel from '../components/VariationPanel.js';

/**
 * Skip adding the panel to blocks we can't meaningfully vary.
 */
const BLOCKLIST = new Set( [
	'core/freeform',
	'core/missing',
	'core/block', // synced pattern wrapper
] );

const withVariationPanel = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		// Don't offer the "save/apply variation" UI inside the variation
		// editor itself — that's where the variation's source block lives.
		const isVariationEditor = !! window.BVM?.isVariationEditor;
		if ( isVariationEditor || BLOCKLIST.has( props.name ) || ! props.isSelected ) {
			return <BlockEdit { ...props } />;
		}
		return (
			<Fragment>
				<BlockEdit { ...props } />
				<VariationPanel
					attributes={ props.attributes }
					setAttributes={ props.setAttributes }
					name={ props.name }
				/>
			</Fragment>
		);
	};
}, 'withVariationPanel' );

addFilter(
	'editor.BlockEdit',
	'bvm/inject-panel',
	withVariationPanel
);
