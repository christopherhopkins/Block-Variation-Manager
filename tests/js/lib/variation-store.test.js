const mockApiFetch = jest.fn();
jest.mock(
	'@wordpress/api-fetch',
	() => ( { __esModule: true, default: ( ...args ) => mockApiFetch( ...args ) } ),
	{ virtual: true }
);

/** Fresh module instance per test — the store keeps module-level caches. */
function loadStore() {
	let mod;
	jest.isolateModules( () => {
		mod = require( '../../../source/lib/variation-store.js' );
	} );
	return mod;
}

const notFound = () => {
	const err = new Error( 'gone' );
	err.data = { status: 404 };
	return err;
};

describe( 'variation-store', () => {
	beforeEach( () => {
		mockApiFetch.mockReset();
	} );

	describe( 'getCached three-state contract', () => {
		it( 'returns undefined for never-fetched ids', () => {
			const { getCached } = loadStore();
			expect( getCached( 5 ) ).toBeUndefined();
		} );

		it( 'returns the record once fetched', async () => {
			const record = { id: 5, attrs: { a: 1 }, block_type: 'core/heading' };
			mockApiFetch.mockResolvedValue( record );
			const { fetchVariation, getCached } = loadStore();
			await fetchVariation( 5 );
			expect( getCached( 5 ) ).toEqual( record );
		} );

		it( 'returns null (confirmed missing) after a 404', async () => {
			mockApiFetch.mockRejectedValue( notFound() );
			const { fetchVariation, getCached } = loadStore();
			expect( await fetchVariation( 5 ) ).toBeNull();
			expect( getCached( 5 ) ).toBeNull();
		} );
	} );

	it( 'negative-caches bvm_not_found error codes too', async () => {
		const err = new Error( 'gone' );
		err.code = 'bvm_not_found';
		mockApiFetch.mockRejectedValue( err );
		const { fetchVariation, getCached } = loadStore();
		expect( await fetchVariation( 9 ) ).toBeNull();
		expect( getCached( 9 ) ).toBeNull();
	} );

	// §9-adjacent: transient failures must NOT be negative-cached — doing so
	// disabled override tracking for a whole session while the server kept
	// merging the variation into renders.
	it( 'does not cache transient failures; next call retries', async () => {
		const err = new Error( '500' );
		err.data = { status: 500 };
		mockApiFetch.mockRejectedValueOnce( err );
		mockApiFetch.mockResolvedValueOnce( { id: 5, attrs: {} } );
		const { fetchVariation, getCached } = loadStore();

		await expect( fetchVariation( 5 ) ).rejects.toThrow( '500' );
		expect( getCached( 5 ) ).toBeUndefined();

		await fetchVariation( 5 );
		expect( getCached( 5 ) ).toEqual( { id: 5, attrs: {} } );
		expect( mockApiFetch ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'dedupes concurrent fetches of the same id', async () => {
		let resolve;
		mockApiFetch.mockReturnValue(
			new Promise( ( r ) => {
				resolve = r;
			} )
		);
		const { fetchVariation } = loadStore();
		const p1 = fetchVariation( 5 );
		const p2 = fetchVariation( 5 );
		resolve( { id: 5 } );
		await Promise.all( [ p1, p2 ] );
		expect( mockApiFetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'resolves falsy ids to null without fetching', async () => {
		const { fetchVariation, ensureVariationLoaded } = loadStore();
		expect( await fetchVariation( 0 ) ).toBeNull();
		expect( await ensureVariationLoaded( undefined ) ).toBeNull();
		expect( mockApiFetch ).not.toHaveBeenCalled();
	} );

	it( 'ensureVariationLoaded serves from cache and swallows errors', async () => {
		const err = new Error( 'network' );
		mockApiFetch.mockRejectedValueOnce( err );
		mockApiFetch.mockResolvedValueOnce( { id: 7, attrs: {} } );
		const { ensureVariationLoaded } = loadStore();

		expect( await ensureVariationLoaded( 7 ) ).toBeNull(); // swallowed
		expect( await ensureVariationLoaded( 7 ) ).toEqual( { id: 7, attrs: {} } );
		// Third call: cached, no new request.
		await ensureVariationLoaded( 7 );
		expect( mockApiFetch ).toHaveBeenCalledTimes( 2 );
	} );

	describe( 'subscribe/notify', () => {
		it( 'bumps the version and notifies on mutations', async () => {
			mockApiFetch.mockResolvedValue( { id: 5, attrs: {} } );
			const { subscribe, getVersion, fetchVariation } = loadStore();
			const listener = jest.fn();
			const unsubscribe = subscribe( listener );
			const before = getVersion();

			await fetchVariation( 5 );
			expect( listener ).toHaveBeenCalledTimes( 1 );
			expect( getVersion() ).toBeGreaterThan( before );

			unsubscribe();
			await fetchVariation( 6 );
			expect( listener ).toHaveBeenCalledTimes( 1 );
		} );
	} );

	describe( 'listForBlockType', () => {
		it( 'caches lists per block type and primes the record cache', async () => {
			const rows = [
				{ id: 1, attrs: {} },
				{ id: 2, attrs: {} },
			];
			mockApiFetch.mockResolvedValue( rows );
			const { listForBlockType, getCached } = loadStore();

			expect( await listForBlockType( 'core/heading' ) ).toEqual( rows );
			expect( mockApiFetch ).toHaveBeenCalledWith( {
				path: '/bvm/v1/variations?block_type=core%2Fheading',
			} );
			expect( getCached( 1 ) ).toEqual( rows[ 0 ] );

			await listForBlockType( 'core/heading' );
			expect( mockApiFetch ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'invalidateList clears one type or all', async () => {
			mockApiFetch.mockResolvedValue( [] );
			const { listForBlockType, invalidateList } = loadStore();
			await listForBlockType( 'a' );
			await listForBlockType( 'b' );
			expect( mockApiFetch ).toHaveBeenCalledTimes( 2 );

			invalidateList( 'a' );
			await listForBlockType( 'a' );
			await listForBlockType( 'b' );
			expect( mockApiFetch ).toHaveBeenCalledTimes( 3 );

			invalidateList();
			await listForBlockType( 'a' );
			await listForBlockType( 'b' );
			expect( mockApiFetch ).toHaveBeenCalledTimes( 5 );
		} );

		it( 'does not let a stale in-flight fetch repopulate an invalidated list (COR-9)', async () => {
			let resolveStale;
			mockApiFetch.mockReturnValueOnce(
				new Promise( ( r ) => {
					resolveStale = r;
				} )
			);
			const { listForBlockType, invalidateList } = loadStore();

			const stale = listForBlockType( 'core/heading' ); // in flight
			invalidateList( 'core/heading' ); // e.g. createVariation finished

			const fresh = [ { id: 99, attrs: {}, title: 'New one' } ];
			mockApiFetch.mockResolvedValueOnce( fresh );
			resolveStale( [] ); // the pre-invalidation response arrives late
			await stale;

			// The next read must refetch, not serve the stale empty list.
			expect( await listForBlockType( 'core/heading' ) ).toEqual( fresh );
			expect( mockApiFetch ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'does not cache a failed list fetch', async () => {
			mockApiFetch.mockRejectedValueOnce( new Error( 'boom' ) );
			mockApiFetch.mockResolvedValueOnce( [] );
			const { listForBlockType } = loadStore();
			await expect( listForBlockType( 'a' ) ).rejects.toThrow( 'boom' );
			expect( await listForBlockType( 'a' ) ).toEqual( [] );
		} );
	} );

	describe( 'listInstances', () => {
		it( 'unwraps the instances array and guards malformed payloads', async () => {
			mockApiFetch.mockResolvedValueOnce( {
				instances: [ { post_id: 1 } ],
			} );
			const { listInstances } = loadStore();
			expect( await listInstances( 3 ) ).toEqual( [ { post_id: 1 } ] );

			mockApiFetch.mockResolvedValueOnce( {} );
			expect( await listInstances( 3 ) ).toEqual( [] );

			expect( await listInstances( 0 ) ).toEqual( [] );
		} );
	} );

	describe( 'createVariation / updateVariation', () => {
		it( 'POSTs the shaped payload, caches, and invalidates the list', async () => {
			const created = { id: 10, block_type: 'core/heading', attrs: {} };
			mockApiFetch.mockResolvedValue( created );
			const { createVariation, getCached } = loadStore();

			await createVariation( {
				title: 'T',
				blockType: 'core/heading',
				attrs: { level: 2 },
				content: '<!-- wp:heading /-->',
				innerBlocks: [ { name: 'core/paragraph' } ],
			} );
			expect( mockApiFetch ).toHaveBeenCalledWith( {
				path: '/bvm/v1/variations',
				method: 'POST',
				data: {
					title: 'T',
					block_type: 'core/heading',
					attrs: { level: 2 },
					content: '<!-- wp:heading /-->',
					inner_blocks: [ { name: 'core/paragraph' } ],
				},
			} );
			expect( getCached( 10 ) ).toEqual( created );
		} );

		it( 'omits inner_blocks when not an array', async () => {
			mockApiFetch.mockResolvedValue( { id: 11, block_type: 'x' } );
			const { createVariation } = loadStore();
			await createVariation( {
				title: 'T',
				blockType: 'x',
				attrs: {},
				content: '',
			} );
			expect(
				mockApiFetch.mock.calls[ 0 ][ 0 ].data
			).not.toHaveProperty( 'inner_blocks' );
		} );

		it( 'PUTs only the provided fields on update', async () => {
			const updated = { id: 10, block_type: 'core/heading' };
			mockApiFetch.mockResolvedValue( updated );
			const { updateVariation, getCached } = loadStore();

			await updateVariation( 10, { attrs: { level: 3 } } );
			expect( mockApiFetch ).toHaveBeenCalledWith( {
				path: '/bvm/v1/variations/10',
				method: 'PUT',
				data: { attrs: { level: 3 } },
			} );
			expect( getCached( 10 ) ).toEqual( updated );

			await updateVariation( 10, {
				title: 'New',
				innerBlocks: [],
			} );
			expect( mockApiFetch.mock.calls[ 1 ][ 0 ].data ).toEqual( {
				title: 'New',
				inner_blocks: [],
			} );
		} );
	} );
} );
