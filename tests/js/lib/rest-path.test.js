import { restPath } from '../../../source/lib/rest-path.js';

describe( 'restPath', () => {
	afterEach( () => {
		delete window.BVM;
	} );

	it( 'falls back to bvm/v1 when window.BVM is absent', () => {
		expect( restPath( '/variations' ) ).toBe( '/bvm/v1/variations' );
	} );

	it( 'uses the localized namespace when present', () => {
		window.BVM = { restNamespace: 'bvm/v2' };
		expect( restPath( '/variations/7' ) ).toBe( '/bvm/v2/variations/7' );
	} );

	it( 'falls back when BVM exists without restNamespace', () => {
		window.BVM = {};
		expect( restPath( '/registry' ) ).toBe( '/bvm/v1/registry' );
	} );
} );
