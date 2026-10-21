/**
 * Harness smoke test: proves Jest resolves the config, transforms ES modules
 * from source/, and runs assertions.
 */
import { deepEqual } from '../../source/lib/equality.js';

describe( 'jest harness', () => {
	it( 'imports ES modules from source/', () => {
		expect( typeof deepEqual ).toBe( 'function' );
	} );
} );
