const mockApiFetch = jest.fn();
jest.mock(
	'@wordpress/api-fetch',
	() => ( { __esModule: true, default: ( ...args ) => mockApiFetch( ...args ) } ),
	{ virtual: true }
);

/** Fresh module instance per test — the registry keeps module-level cache state. */
function loadRegistry() {
	let mod;
	jest.isolateModules( () => {
		mod = require( '../../../source/lib/block-registry.js' );
	} );
	return mod;
}

describe( 'block-registry', () => {
	beforeEach( () => {
		mockApiFetch.mockReset();
	} );

	it( 'returns the EMPTY policy before any load', () => {
		const { hasRequiredChildren } = loadRegistry();
		expect( hasRequiredChildren( 'kadence/rowlayout' ) ).toBe( false );
	} );

	it( 'loads the registry once and answers from cache', async () => {
		mockApiFetch.mockResolvedValue( {
			'kadence/rowlayout': { required_children: [ 'kadence/column' ] },
			'core/paragraph': { required_children: [] },
		} );
		const { ensureRegistryLoaded, hasRequiredChildren } = loadRegistry();

		await ensureRegistryLoaded();
		expect( mockApiFetch ).toHaveBeenCalledTimes( 1 );
		expect( mockApiFetch ).toHaveBeenCalledWith( {
			path: '/bvm/v1/registry',
		} );

		expect( hasRequiredChildren( 'kadence/rowlayout' ) ).toBe( true );
		expect( hasRequiredChildren( 'core/paragraph' ) ).toBe( false );
		expect( hasRequiredChildren( 'core/unknown' ) ).toBe( false );

		// Second call must not refetch.
		await ensureRegistryLoaded();
		expect( mockApiFetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'dedupes concurrent loads into one request', async () => {
		let resolve;
		mockApiFetch.mockReturnValue(
			new Promise( ( r ) => {
				resolve = r;
			} )
		);
		const { ensureRegistryLoaded } = loadRegistry();
		const p1 = ensureRegistryLoaded();
		const p2 = ensureRegistryLoaded();
		resolve( {} );
		await Promise.all( [ p1, p2 ] );
		expect( mockApiFetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'retries after a failed fetch instead of caching the failure', async () => {
		mockApiFetch.mockRejectedValueOnce( new Error( '403' ) );
		mockApiFetch.mockResolvedValueOnce( {
			'kadence/rowlayout': { required_children: [ 'kadence/column' ] },
		} );
		const { ensureRegistryLoaded, hasRequiredChildren } = loadRegistry();

		expect( await ensureRegistryLoaded() ).toBeNull();
		expect( hasRequiredChildren( 'kadence/rowlayout' ) ).toBe( false );

		await ensureRegistryLoaded();
		expect( mockApiFetch ).toHaveBeenCalledTimes( 2 );
		expect( hasRequiredChildren( 'kadence/rowlayout' ) ).toBe( true );
	} );

	it( 'treats a malformed payload as an empty registry', async () => {
		mockApiFetch.mockResolvedValue( 'not-an-object' );
		const { ensureRegistryLoaded, hasRequiredChildren } = loadRegistry();
		await ensureRegistryLoaded();
		expect( hasRequiredChildren( 'anything' ) ).toBe( false );
		// Malformed-but-successful response is cached (no retry storm).
		await ensureRegistryLoaded();
		expect( mockApiFetch ).toHaveBeenCalledTimes( 1 );
	} );
} );
