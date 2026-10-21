<?php
/**
 * @covers \BVM\BlockRegistry
 */

use BVM\BlockRegistry;

class BlockRegistryTest extends WP_UnitTestCase {

	public function test_parent_of_reads_block_json_parent(): void {
		$this->assertSame( 'core/list', BlockRegistry::parent_of( 'core/list-item' ) );
		$this->assertNull( BlockRegistry::parent_of( 'core/paragraph' ) );
		$this->assertNull( BlockRegistry::parent_of( 'acme/unregistered' ) );
	}

	public function test_wrapper_chain_outermost_first(): void {
		$this->assertSame(
			[ 'core/list', 'core/list-item' ],
			BlockRegistry::wrapper_chain( 'core/list-item' )
		);
		$this->assertSame(
			[ 'core/paragraph' ],
			BlockRegistry::wrapper_chain( 'core/paragraph' )
		);
	}

	public function test_all_derives_required_children_from_parent_declarations(): void {
		$map = BlockRegistry::all();
		$this->assertArrayHasKey( 'core/list', $map );
		$this->assertContains( 'core/list-item', $map['core/list']['required_children'] );
	}

	public function test_vendor_defaults_skip_unregistered_parents(): void {
		// Kadence isn't active in the test env, so the seeded
		// kadence/rowlayout entry must not appear.
		$this->assertArrayNotHasKey( 'kadence/rowlayout', BlockRegistry::all() );
	}

	public function test_rest_registry_applies_the_policy_filter(): void {
		// The filter adjusts EXISTING entries (it fires per derived row);
		// empty results are dropped from the payload.
		$filter = static function ( array $entry, string $name ): array {
			if ( 'core/list' === $name ) {
				$entry['required_children'][] = 'acme/extra-child';
			}
			if ( 'core/buttons' === $name ) {
				$entry['required_children'] = [];
			}
			return $entry;
		};
		add_filter( 'bvm/block_policy', $filter, 10, 2 );
		try {
			$map = BlockRegistry::rest_get_registry();
			$this->assertContains( 'acme/extra-child', $map['core/list']['required_children'] );
			$this->assertArrayNotHasKey( 'core/buttons', $map );
		} finally {
			remove_filter( 'bvm/block_policy', $filter, 10 );
		}
	}
}
