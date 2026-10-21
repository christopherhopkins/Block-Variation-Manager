<?php
/**
 * Regression tests for §9.19: the render merge must also run inside
 * Kadence's head-CSS pass (`kadence_blocks_frontend_build_css`), which on
 * classic themes builds frontend CSS from raw post_content attrs before
 * render_block_data ever fires — and whose output suppresses the
 * render-time rebuild. Kadence itself is not installed in this test env;
 * what's under test is the filter contract BVM provides for it.
 */

use BVM\Render;

class RenderHeadCssTest extends WP_UnitTestCase {

	private function make_variation( array $attrs, string $block_type = 'kadence/rowlayout' ): int {
		$vid = self::factory()->post->create(
			[
				'post_type'   => BVM_CPT,
				'post_status' => 'publish',
				'post_title'  => 'Head CSS variation',
			]
		);
		update_post_meta( $vid, BVM_META_BLOCK_TYPE, $block_type );
		update_post_meta( $vid, BVM_META_ATTRS, wp_slash( wp_json_encode( $attrs ) ) );
		return $vid;
	}

	public function test_merge_is_hooked_on_kadence_head_css_filter() {
		$this->assertNotFalse(
			has_filter( 'kadence_blocks_frontend_build_css', [ Render::class, 'apply_variation' ] ),
			'Render::apply_variation must be hooked on kadence_blocks_frontend_build_css (§9.19).'
		);
	}

	public function test_head_css_pass_receives_merged_attrs() {
		$vid = $this->make_variation( [ 'colLayout' => 'equal', 'bgColor' => '#8b6f47' ] );

		// What Kadence's frontend_css_parse hands the filter: a raw
		// parse_blocks() block with the stale baked attrs.
		$raw = [
			'blockName'   => 'kadence/rowlayout',
			'attrs'       => [
				'uniqueID'           => '88_inst1-aa',
				'bgColor'            => '#cc3322',
				'kbVersion'          => 2,
				'bvmVariationId'     => $vid,
				'bvmOverriddenAttrs' => [],
			],
			'innerBlocks' => [],
		];

		$filtered = apply_filters( 'kadence_blocks_frontend_build_css', $raw );

		$this->assertSame( '#8b6f47', $filtered['attrs']['bgColor'], 'Head-pass CSS must be built from the variation value, not the baked one.' );
		$this->assertSame( '88_inst1-aa', $filtered['attrs']['uniqueID'], 'Per-instance identity attrs must never be overwritten by the merge.' );
	}

	public function test_head_css_pass_respects_overrides() {
		$vid = $this->make_variation( [ 'bgColor' => '#8b6f47' ] );

		$raw = [
			'blockName'   => 'kadence/rowlayout',
			'attrs'       => [
				'uniqueID'           => '88_inst2-aa',
				'bgColor'            => '#cc3322',
				'bvmVariationId'     => $vid,
				'bvmOverriddenAttrs' => [ 'bgColor' ],
			],
			'innerBlocks' => [],
		];

		$filtered = apply_filters( 'kadence_blocks_frontend_build_css', $raw );
		$this->assertSame( '#cc3322', $filtered['attrs']['bgColor'] );
	}

	public function test_non_array_input_passes_through() {
		$obj = (object) [ 'blockName' => 'kadence/rowlayout' ];
		$this->assertSame( $obj, Render::apply_variation( $obj ), 'The filter chain may carry objects; they must pass through untouched.' );
	}
}
