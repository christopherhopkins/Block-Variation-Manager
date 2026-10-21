<?php
/**
 * @covers \BVM\Migration
 */

use BVM\Migration;

class MigrationTest extends WP_UnitTestCase {

	public function set_up(): void {
		parent::set_up();
		delete_option( 'bvm_migration_version' );
	}

	public function test_v1_renames_cpt_meta_and_content_identifiers(): void {
		global $wpdb;

		$legacy = self::factory()->post->create(
			[
				'post_type'    => 'post',
				'post_content' => '<!-- wp:heading {"ncssVariationId":5,"ncssOverriddenAttrs":["level"]} --><h2>x</h2><!-- /wp:heading -->',
			]
		);
		$cpt_post = self::factory()->post->create( [ 'post_type' => 'post' ] );
		$wpdb->update( $wpdb->posts, [ 'post_type' => 'ncss_block_variation' ], [ 'ID' => $cpt_post ] );
		update_post_meta( $cpt_post, '_dummy', 'x' );
		$wpdb->insert(
			$wpdb->postmeta,
			[
				'post_id'    => $cpt_post,
				'meta_key'   => '_ncss_variation_block_type',
				'meta_value' => 'core/heading',
			]
		);
		clean_post_cache( $cpt_post );
		clean_post_cache( $legacy );

		Migration::maybe_run();

		$this->assertSame( BVM_CPT, get_post( $cpt_post )->post_type );
		$this->assertSame( 'core/heading', get_post_meta( $cpt_post, BVM_META_BLOCK_TYPE, true ) );
		$content = get_post( $legacy )->post_content;
		$this->assertStringContainsString( '"bvmVariationId":5', $content );
		$this->assertStringContainsString( '"bvmOverriddenAttrs":["level"]', $content );
		$this->assertStringNotContainsString( 'ncss', $content );

		$this->assertGreaterThanOrEqual( 1, (int) get_option( 'bvm_migration_version' ) );
	}

	public function test_v1_is_guarded_by_the_version_option(): void {
		global $wpdb;
		update_option( 'bvm_migration_version', '1', true );

		$cpt_post = self::factory()->post->create( [ 'post_type' => 'post' ] );
		$wpdb->update( $wpdb->posts, [ 'post_type' => 'ncss_block_variation' ], [ 'ID' => $cpt_post ] );
		clean_post_cache( $cpt_post );

		Migration::maybe_run();
		$this->assertSame( 'ncss_block_variation', get_post( $cpt_post )->post_type );
	}

	public function test_v2_resets_snapshots_only_for_flipped_block_types(): void {
		update_option( 'bvm_migration_version', '1', true );

		// core/heading is a flipped type in modern WP: is_dynamic() true (its
		// callback only filters saved markup) AND needs_bake true (§9.18) —
		// exactly the misclassification v2 exists to repair.
		$flipped = self::factory()->post->create(
			[ 'post_type' => BVM_CPT, 'post_status' => 'publish' ]
		);
		update_post_meta( $flipped, BVM_META_BLOCK_TYPE, 'core/heading' );
		update_post_meta( $flipped, BVM_META_PROPAGATED_SOURCE, 'stale-snapshot' );

		// core/paragraph is static-save with no render_callback — not
		// flipped, its snapshot stays precise. (core/list-item is NOT a safe
		// control: some WP builds give it a markup-filter callback, making it
		// a flipped type whose snapshot v2 correctly resets.)
		$static = self::factory()->post->create(
			[ 'post_type' => BVM_CPT, 'post_status' => 'publish' ]
		);
		update_post_meta( $static, BVM_META_BLOCK_TYPE, 'core/paragraph' );
		update_post_meta( $static, BVM_META_PROPAGATED_SOURCE, 'valid-snapshot' );

		Migration::maybe_run_v2();

		$this->assertSame( '', get_post_meta( $flipped, BVM_META_PROPAGATED_SOURCE, true ) );
		$this->assertSame( 'valid-snapshot', get_post_meta( $static, BVM_META_PROPAGATED_SOURCE, true ) );
		$this->assertSame( '2', get_option( 'bvm_migration_version' ) );
	}

	public function test_v2_skips_when_already_current(): void {
		update_option( 'bvm_migration_version', '2', true );
		$vid = self::factory()->post->create(
			[ 'post_type' => BVM_CPT, 'post_status' => 'publish' ]
		);
		update_post_meta( $vid, BVM_META_BLOCK_TYPE, 'core/latest-posts' );
		update_post_meta( $vid, BVM_META_PROPAGATED_SOURCE, 'snapshot' );

		Migration::maybe_run_v2();
		$this->assertSame( 'snapshot', get_post_meta( $vid, BVM_META_PROPAGATED_SOURCE, true ) );
	}
}
