/** Stub for @wordpress/editor (webpack external in the real build). */
export const PluginDocumentSettingPanel = ( { title, children } ) => (
	<div data-testid="document-setting-panel">
		<h2>{ title }</h2>
		{ children }
	</div>
);
