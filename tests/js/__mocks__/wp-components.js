/**
 * Stub for @wordpress/components (webpack external in the real build).
 * Minimal HTML stand-ins preserving the interaction contract the plugin uses.
 */
import { useState } from 'react';

export const PanelBody = ( { title, children } ) => (
	<section>
		<h2>{ title }</h2>
		{ children }
	</section>
);

export const Button = ( { children, onClick, disabled, label, variant } ) => (
	<button
		type="button"
		onClick={ onClick }
		disabled={ disabled }
		aria-label={ label }
		data-variant={ variant }
	>
		{ children }
	</button>
);

export const SelectControl = ( { label, value, options = [], onChange, help } ) => (
	<label>
		{ label }
		<select
			value={ value }
			onChange={ ( e ) => onChange( e.target.value ) }
		>
			{ options.map( ( o ) => (
				<option key={ o.value } value={ o.value }>
					{ o.label }
				</option>
			) ) }
		</select>
		{ help && <span>{ help }</span> }
	</label>
);

export const TextControl = ( { label, value, onChange, placeholder } ) => (
	<label>
		{ label }
		<input
			value={ value }
			placeholder={ placeholder }
			onChange={ ( e ) => onChange( e.target.value ) }
		/>
	</label>
);

export const Notice = ( { children, status } ) => (
	<div role="alert" data-status={ status }>
		{ children }
	</div>
);

export const Spinner = () => <span data-testid="spinner" />;

export const Flex = ( { children } ) => <div>{ children }</div>;
export const FlexItem = ( { children } ) => <div>{ children }</div>;
export const MenuGroup = ( { children } ) => <div>{ children }</div>;

export const MenuItem = ( { children, onClick } ) => (
	<button type="button" onClick={ onClick }>
		{ children }
	</button>
);

export const Dropdown = ( { renderToggle, renderContent } ) => {
	const [ isOpen, setIsOpen ] = useState( false );
	return (
		<div>
			{ renderToggle( {
				isOpen,
				onToggle: () => setIsOpen( ! isOpen ),
			} ) }
			{ isOpen && renderContent( { onClose: () => setIsOpen( false ) } ) }
		</div>
	);
};

export const __experimentalHStack = ( { children } ) => <div>{ children }</div>;

export const __experimentalText = ( { children } ) => <span>{ children }</span>;

export const __experimentalConfirmDialog = ( {
	children,
	onConfirm,
	onCancel,
	confirmButtonText,
	cancelButtonText,
} ) => (
	<div role="dialog">
		<p>{ children }</p>
		<button type="button" onClick={ onConfirm }>
			{ confirmButtonText ?? 'OK' }
		</button>
		<button type="button" onClick={ onCancel }>
			{ cancelButtonText ?? 'Cancel' }
		</button>
	</div>
);
