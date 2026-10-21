<?php
/**
 * @covers \BVM\Inserter
 */

use BVM\Inserter;

class InserterTest extends WP_UnitTestCase {

	public function set_up(): void {
		parent::set_up();
		Inserter::flush_cache();
	}

	private function create_variation( string $title, string $block_type, array $attrs, ?array $inner = null ): int {
		$vid = self::factory()->post->create(
			[
				'post_type'   => BVM_CPT,
				'post_status' => 'publish',
				'post_title'  => $title,
			]
		);
		update_post_meta( $vid, BVM_META_BLOCK_TYPE, $block_type );
		update_post_meta( $vid, BVM_META_ATTRS, wp_slash( wp_json_encode( $attrs ) ) );
		if ( null !== $inner ) {
			update_post_meta( $vid, BVM_META_INNER_BLOCKS, wp_slash( wp_json_encode( $inner ) ) );
		}
		Inserter::flush_cache();
		return $vid;
	}

	private function variations_for( string $block_name ): array {
		$type = WP_Block_Type_Registry::get_instance()->get_registered( $block_name );
		return Inserter::add_variations( [], $type );
	}

	public function test_published_variation_appears_for_its_block_type_only(): void {
		$vid  = $this->create_variation( 'Brand hero', 'core/heading', [ 'level' => 3 ] );
		$defs = $this->variations_for( 'core/heading' );

		$this->assertCount( 1, $defs );
		$this->assertSame( 'bvm-' . $vid, $defs[0]['name'] );
		$this->assertSame( 'Brand hero', $defs[0]['title'] );
		$this->assertSame( [ 'inserter', 'transform' ], $defs[0]['scope'] );
		$this->assertSame( 3, $defs[0]['attributes']['level'] );
		// Inserting pre-links the instance with a clean override list.
		$this->assertSame( $vid, $defs[0]['attributes']['bvmVariationId'] );
		$this->assertSame( [], $defs[0]['attributes']['bvmOverriddenAttrs'] );
		$this->assertArrayNotHasKey( 'innerBlocks', $defs[0] );

		$this->assertSame( [], $this->variations_for( 'core/paragraph' ) );
	}

	public function test_inner_block_template_rides_along(): void {
		$inner = [ [ 'core/paragraph', [ 'placeholder' => 'x' ], [] ] ];
		$this->create_variation( 'Group', 'core/group', [], $inner );
		$defs = $this->variations_for( 'core/group' );
		$this->assertSame( $inner, $defs[0]['innerBlocks'] );
	}

	public function test_drafts_and_typeless_variations_are_ignored(): void {
		$vid = $this->create_variation( 'Draft', 'core/heading', [] );
		wp_update_post( [ 'ID' => $vid, 'post_status' => 'draft' ] );
		Inserter::flush_cache();
		$this->assertSame( [], $this->variations_for( 'core/heading' ) );

		self::factory()->post->create(
			[ 'post_type' => BVM_CPT, 'post_status' => 'publish' ]
		);
		Inserter::flush_cache();
		$this->assertSame( [], $this->variations_for( 'core/heading' ) );
	}

	public function test_cache_is_flushed_on_variation_save(): void {
		$this->create_variation( 'First', 'core/heading', [] );
		$this->assertCount( 1, $this->variations_for( 'core/heading' ) );

		// A new save mid-request must invalidate the request cache (hooked
		// via save_post_bvm_variation → flush_cache).
		$this->create_variation( 'Second', 'core/heading', [] );
		$this->assertCount( 2, $this->variations_for( 'core/heading' ) );
	}
}
