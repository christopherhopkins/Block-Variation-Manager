<?php
/**
 * Multisite coverage: CPT registration, propagation, and REST isolation are
 * all per-site — a variation on one site must never reach another.
 *
 * Runs only under `npm run test:php:ms` (WP_MULTISITE=1); skipped otherwise.
 *
 * @group ms-required
 * @covers \BVM\CPT
 * @covers \BVM\Render
 * @covers \BVM\Propagate
 */

use BVM\CPT;
use BVM\Propagate;
use BVM\Render;

class MultisiteTest extends WP_UnitTestCase {

	public function set_up(): void {
		parent::set_up();
		if ( ! is_multisite() ) {
			$this->markTestSkipped( 'Multisite-only test (run npm run test:php:ms).' );
		}
	}

	private function create_variation_here(): int {
		$vid = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_content' => '<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">Site A</h3><!-- /wp:heading -->',
			]
		);
		update_post_meta( $vid, BVM_META_BLOCK_TYPE, 'core/heading' );
		CPT::sync_attrs_from_content( $vid, get_post( $vid ) );
		Propagate::write_snapshot( $vid );
		return $vid;
	}

	public function test_cpt_is_registered_on_every_site(): void {
		$site = self::factory()->blog->create();
		switch_to_blog( $site );
		try {
			// register_post_type state is global per request; creating a
			// variation on the new site must work.
			$vid = self::factory()->post->create(
				[ 'post_type' => BVM_CPT, 'post_status' => 'publish' ]
			);
			$this->assertSame( BVM_CPT, get_post( $vid )->post_type );
		} finally {
			restore_current_blog();
		}
	}

	public function test_variations_are_site_local(): void {
		$vid  = $this->create_variation_here();
		$site = self::factory()->blog->create();

		switch_to_blog( $site );
		try {
			// Same ID on another site is a different (or absent) post.
			$this->assertNull( CPT::get_attrs( $vid ) );
			$this->assertSame( 0, CPT::count_usage( $vid ) );

			// Render merge must not apply the other site's preset.
			$block  = [
				'blockName'    => 'core/heading',
				'attrs'        => [ 'bvmVariationId' => $vid, 'level' => 5 ],
				'innerBlocks'  => [],
				'innerHTML'    => '',
				'innerContent' => [],
			];
			$result = Render::apply_variation( $block );
			$this->assertSame( 5, $result['attrs']['level'] );
		} finally {
			restore_current_blog();
		}
	}

	public function test_propagation_touches_only_the_variations_own_site(): void {
		$vid      = $this->create_variation_here();
		$instance = self::factory()->post->create(
			[
				'post_status'  => 'publish',
				'post_content' => '<!-- wp:heading {"level":3,"bvmVariationId":' . $vid . '} --><h3 class="wp-block-heading">Site A</h3><!-- /wp:heading -->',
			]
		);

		// A doppelgänger instance on another site referencing the same id.
		$site = self::factory()->blog->create();
		switch_to_blog( $site );
		$foreign = self::factory()->post->create(
			[
				'post_status'  => 'publish',
				'post_content' => '<!-- wp:heading {"level":3,"bvmVariationId":' . $vid . '} --><h3 class="wp-block-heading">Site A</h3><!-- /wp:heading -->',
			]
		);
		restore_current_blog();

		wp_update_post(
			[
				'ID'           => $vid,
				'post_content' => '<!-- wp:heading {"level":2} --><h2 class="wp-block-heading">Site A v2</h2><!-- /wp:heading -->',
			]
		);
		Propagate::run( $vid );

		$this->assertStringContainsString( 'Site A v2', get_post( $instance )->post_content );

		switch_to_blog( $site );
		try {
			$this->assertStringNotContainsString(
				'Site A v2',
				get_post( $foreign )->post_content
			);
		} finally {
			restore_current_blog();
		}
	}

	public function test_skipped_notice_option_is_site_local(): void {
		$vid      = $this->create_variation_here();
		$instance = self::factory()->post->create(
			[
				'post_status'  => 'publish',
				'post_content' => '<!-- wp:heading {"level":3,"bvmVariationId":' . $vid . ',"bvmOverriddenAttrs":["level"]} --><h3 class="wp-block-heading">Site A</h3><!-- /wp:heading -->',
			]
		);
		wp_update_post(
			[
				'ID'           => $vid,
				'post_content' => '<!-- wp:heading {"level":2} --><h2 class="wp-block-heading">v2</h2><!-- /wp:heading -->',
			]
		);
		Propagate::run( $vid );
		$this->assertArrayHasKey( $vid, (array) get_option( Propagate::SKIPPED_OPT, [] ) );

		$site = self::factory()->blog->create();
		switch_to_blog( $site );
		try {
			$this->assertArrayNotHasKey(
				$vid,
				(array) get_option( Propagate::SKIPPED_OPT, [] )
			);
		} finally {
			restore_current_blog();
		}
	}
}
