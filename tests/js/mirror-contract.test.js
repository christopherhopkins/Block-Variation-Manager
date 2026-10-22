/**
 * QUA-21: the PHP↔JS mirror contract. The values live in ONE fixture
 * (tests/fixtures/mirror-contract.json) asserted from both Jest and PHPUnit
 * (MirrorContractTest), so neither side can drift alone.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PRESET_EXCLUDED_ATTRS } from '../../source/constants.js';
import { shapeInnerBlocks } from '../../source/lib/preset.js';

const contract = JSON.parse(
	readFileSync( join( __dirname, '../fixtures/mirror-contract.json' ), 'utf8' )
);

describe( 'PHP↔JS mirror contract', () => {
	it( 'PRESET_EXCLUDED_ATTRS matches the shared contract exactly', () => {
		expect( [ ...PRESET_EXCLUDED_ATTRS ].sort() ).toEqual(
			[ ...contract.excludedAttrs ].sort()
		);
	} );

	it( 'shapeInnerBlocks reproduces the contract capture (incl. §9.16 links)', () => {
		expect(
			shapeInnerBlocks( contract.linkedChildCapture.inputObjects )
		).toEqual( contract.linkedChildCapture.expectedObjects );
	} );
} );
