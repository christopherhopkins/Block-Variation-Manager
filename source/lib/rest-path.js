/** Build a plugin REST path. Single home for the namespace fallback. */
export const restPath = ( suffix ) =>
	`/${ window.BVM?.restNamespace ?? 'bvm/v1' }${ suffix }`;
