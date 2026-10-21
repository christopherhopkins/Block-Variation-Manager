<?php
/**
 * @covers \BVM\Render
 */

use BVM\Render;

class RenderTest extends WP_UnitTestCase {

	private function create_variation( array $attrs, string $block_type = 'core/heading' ): int {
		$variation_id = self::factory()->post->create(
			[
				'post_type'   => BVM_CPT,
				'post_status' => 'publish',
			]
		);
		update_post_meta( $variation_id, BVM_META_BLOCK_TYPE, $block_type );
		update_post_meta( $variation_id, BVM_META_ATTRS, wp_slash( wp_json_encode( $attrs ) ) );
		return $variation_id;
	}

	private function parsed_block( array $attrs, string $name = 'core/heading' ): array {
		return [
			'blockName'    => $name,
			'attrs'        => $attrs,
			'innerBlocks'  => [],
			'innerHTML'    => '',
			'innerContent' => [],
		];
	}

	public function test_merges_variation_attrs_over_instance_values(): void {
		$vid    = $this->create_variation( [ 'level' => 2, 'textAlign' => 'center' ] );
		$result = Render::apply_variation(
			$this->parsed_block( [ 'bvmVariationId' => $vid, 'level' => 4 ] )
		);
		$this->assertSame( 2, $result['attrs']['level'] );
		$this->assertSame( 'center', $result['attrs']['textAlign'] );
	}

	public function test_overridden_attrs_keep_the_instance_value(): void {
		$vid    = $this->create_variation( [ 'level' => 2, 'textAlign' => 'center' ] );
		$result = Render::apply_variation(
			$this->parsed_block(
				[
					'bvmVariationId'     => $vid,
					'bvmOverriddenAttrs' => [ 'level' ],
					'level'              => 4,
				]
			)
		);
		$this->assertSame( 4, $result['attrs']['level'] );
		$this->assertSame( 'center', $result['attrs']['textAlign'] );
	}

	public function test_excluded_attrs_never_propagate_even_from_legacy_meta(): void {
		// Meta written before the strip rule could carry identity keys.
		$vid    = $this->create_variation( [ 'level' => 2, 'uniqueID' => 'stale', 'className' => 'stale' ] );
		$result = Render::apply_variation(
			$this->parsed_block( [ 'bvmVariationId' => $vid, 'className' => 'mine' ] )
		);
		$this->assertSame( 'mine', $result['attrs']['className'] );
		$this->assertArrayNotHasKey( 'uniqueID', $result['attrs'] );
	}

	public function test_type_mismatched_link_is_left_alone(): void {
		$vid   = $this->create_variation( [ 'level' => 2 ], 'core/heading' );
		$block = $this->parsed_block( [ 'bvmVariationId' => $vid ], 'core/paragraph' );
		$this->assertSame( $block, Render::apply_variation( $block ) );
	}

	public function test_unlinked_blocks_pass_through(): void {
		$block = $this->parsed_block( [ 'level' => 4 ] );
		$this->assertSame( $block, Render::apply_variation( $block ) );
	}

	public function test_unpublished_variation_does_not_merge(): void {
		$vid = $this->create_variation( [ 'level' => 2 ] );
		wp_update_post( [ 'ID' => $vid, 'post_status' => 'draft' ] );
		$block  = $this->parsed_block( [ 'bvmVariationId' => $vid, 'level' => 4 ] );
		$result = Render::apply_variation( $block );
		$this->assertSame( 4, $result['attrs']['level'] );
	}

	public function test_render_filter_is_registered(): void {
		$this->assertNotFalse(
			has_filter( 'render_block_data', [ Render::class, 'apply_variation' ] )
		);
	}
}
