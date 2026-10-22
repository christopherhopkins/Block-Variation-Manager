/** Stub for @wordpress/blocks (webpack external in the real build). */
let nextClientId = 1;

export const createBlock = jest.fn( ( name, attributes = {}, innerBlocks = [] ) => ( {
	clientId: `mock-${ nextClientId++ }`,
	name,
	attributes,
	innerBlocks,
} ) );

export const serialize = jest.fn( () => '<!-- wp:mock /-->' );

/** Every block type "exists" unless a test overrides this. */
export const getBlockType = jest.fn( ( name ) => ( { name } ) );
