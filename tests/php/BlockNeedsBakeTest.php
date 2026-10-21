<?php
/**
 * Regression tests for the bake classification (TECHNICAL.md §9.18) and the
 * v2 stale-snapshot migration.
 *
 * The shipped bug: WP 6.6 gave several static-save core blocks lightweight
 * render callbacks that only filter saved markup (block_core_heading_render,
 * …), so a classification keyed on `! is_dynamic()` routed them out of the
 * cron bake path — variation edits never reached the frontend until each
 * post was reopened and re-saved in the editor.
 */

use BVM\CPT;
use BVM\Migration;
use BVM\Propagate;

class BlockNeedsBakeTest extends WP_UnitTestCase {

	/** @var string[] */
	private $registered = [];

	private function register_type( string $name, array $args ): void {
		register_block_type( $name, $args );
		$this->registered[] = $name;
	}

	public function tear_down() {
		foreach ( $this->registered as $name ) {
			unregister_block_type( $name );
		}
		$this->registered = [];
		parent::tear_down();
	}

	public function test_static_save_block_needs_bake() {
		$this->register_type(
			'bvmtest/static',
			[ 'attributes' => [ 'content' => [ 'type' => 'string', 'source' => 'html' ] ] ]
		);
		$this->assertTrue( CPT::block_needs_bake( 'bvmtest/static' ) );
	}

	public function test_markup_filter_callback_still_needs_bake() {
		// WP 6.6-style core block: "dynamic" per is_dynamic(), but its content
		// lives in baked markup (markup-sourced attribute).
		$this->register_type(
			'bvmtest/markup-filter',
			[
				'attributes'      => [ 'content' => [ 'type' => 'string', 'source' => 'rich-text' ] ],
				'render_callback' => static function ( $attrs, $content ) {
					return $content;
				},
			]
		);
		$this->assertTrue( CPT::block_needs_bake( 'bvmtest/markup-filter' ) );
	}

	public function test_identity_bearing_dynamic_block_does_not_bake() {
		// Kadence-style: markup-sourced content AND a uniqueID identity attr.
		// Baking these would flag every instance diverged forever (§9.17).
		$this->register_type(
			'bvmtest/identity',
			[
				'attributes'      => [
					'content'  => [ 'type' => 'string', 'source' => 'html' ],
					'uniqueID' => [ 'type' => 'string' ],
				],
				'render_callback' => '__return_empty_string',
			]
		);
		$this->assertFalse( CPT::block_needs_bake( 'bvmtest/identity' ) );
	}

	public function test_pure_dynamic_block_does_not_bake() {
		$this->register_type(
			'bvmtest/dynamic',
			[
				'attributes'      => [ 'count' => [ 'type' => 'number' ] ],
				'render_callback' => '__return_empty_string',
			]
		);
		$this->assertFalse( CPT::block_needs_bake( 'bvmtest/dynamic' ) );
	}

	public function test_unregistered_block_defaults_to_bake() {
		$this->assertTrue( CPT::block_needs_bake( 'bvmtest/never-registered' ) );
	}

	public function test_core_heading_needs_bake() {
		// Version-safe either way: static save pre-6.6, markup filter after.
		$this->assertTrue( CPT::block_needs_bake( 'core/heading' ) );
	}

	public function test_filter_overrides_classification() {
		add_filter( 'bvm_block_needs_bake', '__return_false' );
		$this->assertFalse( CPT::block_needs_bake( 'core/heading' ) );
		remove_filter( 'bvm_block_needs_bake', '__return_false' );
	}

	public function test_variation_edit_rebakes_core_heading_instance() {
		$vid = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_title'   => 'Heading variation',
				'post_content' => "<!-- wp:heading {\"level\":3} -->\n<h3 class=\"wp-block-heading\">Original</h3>\n<!-- /wp:heading -->",
			]
		);
		update_post_meta( $vid, BVM_META_BLOCK_TYPE, 'core/heading' );
		update_post_meta( $vid, BVM_META_ATTRS, wp_slash( wp_json_encode( [ 'level' => 3, 'content' => 'Original' ] ) ) );
		Propagate::write_snapshot( $vid );

		$inst = self::factory()->post->create(
			[
				'post_status'  => 'publish',
				'post_content' => "<!-- wp:heading {\"level\":3,\"bvmVariationId\":{$vid},\"bvmOverriddenAttrs\":[]} -->\n<h3 class=\"wp-block-heading\">Original</h3>\n<!-- /wp:heading -->",
			]
		);

		// Mirror the variation editor's save flow: content save, then the
		// post-save attrs sync (meta-only).
		wp_update_post(
			wp_slash(
				[
					'ID'           => $vid,
					'post_content' => "<!-- wp:heading {\"level\":3} -->\n<h3 class=\"wp-block-heading\">Updated</h3>\n<!-- /wp:heading -->",
				]
			)
		);
		update_post_meta( $vid, BVM_META_ATTRS, wp_slash( wp_json_encode( [ 'level' => 3, 'content' => 'Updated' ] ) ) );

		Propagate::run( $vid, 0 );

		$content = get_post( $inst )->post_content;
		$this->assertStringContainsString( 'Updated', $content, 'Instance baked HTML was not rewritten by propagation.' );
		$this->assertStringNotContainsString( 'Original', $content );
		$this->assertStringContainsString( '"bvmVariationId":' . $vid, $content, 'Instance lost its variation link.' );
	}

	public function test_migration_v2_resets_snapshots_for_reclassified_types_only() {
		$this->register_type(
			'bvmtest/flipped',
			[
				'attributes'      => [ 'content' => [ 'type' => 'string', 'source' => 'html' ] ],
				'render_callback' => static function ( $attrs, $content ) {
					return $content;
				},
			]
		);

		$flipped = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_content' => "<!-- wp:bvmtest/flipped -->\n<p>x</p>\n<!-- /wp:bvmtest/flipped -->",
			]
		);
		update_post_meta( $flipped, BVM_META_BLOCK_TYPE, 'bvmtest/flipped' );
		update_post_meta( $flipped, BVM_META_PROPAGATED_SOURCE, 'stale-snapshot' );

		$static = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_content' => "<!-- wp:paragraph -->\n<p>x</p>\n<!-- /wp:paragraph -->",
			]
		);
		update_post_meta( $static, BVM_META_BLOCK_TYPE, 'core/paragraph' );
		update_post_meta( $static, BVM_META_PROPAGATED_SOURCE, 'valid-snapshot' );

		update_option( 'bvm_migration_version', '1', true );
		Migration::maybe_run_v2();

		$this->assertSame( '', get_post_meta( $flipped, BVM_META_PROPAGATED_SOURCE, true ), 'Snapshot of a reclassified block type must be reset.' );
		$this->assertSame( 'valid-snapshot', get_post_meta( $static, BVM_META_PROPAGATED_SOURCE, true ), 'Snapshot of a genuinely static block type must be kept.' );
		$this->assertSame( '2', get_option( 'bvm_migration_version' ) );
	}
}
