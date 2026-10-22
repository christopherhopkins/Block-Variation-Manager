<?php
/**
 * @covers \BVM\Propagate
 */

use BVM\Propagate;

class PropagateTest extends WP_UnitTestCase {

	use VariationFixtures;

	private function create_variation( string $text = 'Original', int $level = 3 ): int {
		return $this->create_heading_variation( $text, $level );
	}

	private function create_instance( int $variation_id, array $extra_attrs = [], string $text = 'Original', int $level = 3 ): int {
		return $this->create_heading_instance( $variation_id, $extra_attrs, $text, $level );
	}

	private function update_variation( int $variation_id, string $text, int $level ): void {
		$this->update_heading_variation( $variation_id, $text, $level );
	}

	public function test_in_sync_instance_is_rebaked(): void {
		$variation_id = $this->create_variation( 'Original', 3 );
		$instance_id  = $this->create_instance( $variation_id );

		$this->update_variation( $variation_id, 'Updated headline', 2 );
		Propagate::run( $variation_id );

		$content = get_post( $instance_id )->post_content;
		$this->assertStringContainsString( 'Updated headline', $content );
		$this->assertStringContainsString( '<h2', $content );
		$this->assertStringContainsString( '"bvmVariationId":' . $variation_id, $content );

		// Not reported as skipped.
		$skipped = get_option( Propagate::SKIPPED_OPT, [] );
		$this->assertArrayNotHasKey( $variation_id, (array) $skipped );
	}

	public function test_instance_with_overrides_is_skipped_and_surfaced(): void {
		$variation_id = $this->create_variation( 'Original', 3 );
		$instance_id  = $this->create_instance(
			$variation_id,
			[ 'bvmOverriddenAttrs' => [ 'level' ] ]
		);

		$this->update_variation( $variation_id, 'Updated', 2 );
		Propagate::run( $variation_id );

		// Content untouched — the override blocks the bake-splice.
		$content = get_post( $instance_id )->post_content;
		$this->assertStringContainsString( 'Original', $content );
		$this->assertStringNotContainsString( 'Updated', $content );

		$skipped = get_option( Propagate::SKIPPED_OPT, [] );
		$this->assertArrayHasKey( $variation_id, $skipped );
		$rows = $skipped[ $variation_id ];
		$this->assertCount( 1, $rows );
		$this->assertSame( $instance_id, $rows[0]['id'] );
		$this->assertSame( [ 'level' ], $rows[0]['overrides'] );
	}

	public function test_hand_edited_instance_is_skipped_as_content_diverged(): void {
		$variation_id = $this->create_variation( 'Original', 3 );
		$instance_id  = $this->create_instance( $variation_id, [], 'Hand-edited text', 3 );

		$this->update_variation( $variation_id, 'Updated', 2 );
		Propagate::run( $variation_id );

		$content = get_post( $instance_id )->post_content;
		$this->assertStringContainsString( 'Hand-edited text', $content );
		$this->assertStringNotContainsString( 'Updated', $content );

		$skipped = get_option( Propagate::SKIPPED_OPT, [] );
		$this->assertArrayHasKey( $variation_id, $skipped );
		$this->assertTrue( (bool) $skipped[ $variation_id ][0]['content_diverged'] );
	}

	public function test_unlinked_and_other_variation_instances_are_untouched(): void {
		$variation_id = $this->create_variation( 'Original', 3 );
		$unlinked_id  = self::factory()->post->create(
			[
				'post_type'    => 'post',
				'post_status'  => 'publish',
				'post_content' => $this->heading_block( [ 'level' => 3 ], 'Original', 3 ),
			]
		);
		$other_link = $this->create_instance( $variation_id + 1000 );

		$this->update_variation( $variation_id, 'Updated', 2 );
		Propagate::run( $variation_id );

		$this->assertStringNotContainsString( 'Updated', get_post( $unlinked_id )->post_content );
		$this->assertStringNotContainsString( 'Updated', get_post( $other_link )->post_content );
	}

	public function test_run_updates_snapshot_after_completion(): void {
		$variation_id = $this->create_variation( 'Original', 3 );
		$this->create_instance( $variation_id );

		$this->update_variation( $variation_id, 'Updated', 2 );
		Propagate::run( $variation_id );

		$snapshot = get_post_meta( $variation_id, BVM_META_PROPAGATED_SOURCE, true );
		$this->assertStringContainsString( 'Updated', $snapshot );

		// A second run against the SAME content is a no-op: the rebaked
		// instance now matches the new snapshot.
		Propagate::run( $variation_id );
		$skipped = get_option( Propagate::SKIPPED_OPT, [] );
		$this->assertArrayNotHasKey( $variation_id, (array) $skipped );
	}

	public function test_run_ignores_non_publish_variations(): void {
		$variation_id = $this->create_variation( 'Original', 3 );
		$instance_id  = $this->create_instance( $variation_id );

		$this->update_variation( $variation_id, 'Updated', 2 );
		wp_update_post(
			[
				'ID'          => $variation_id,
				'post_status' => 'draft',
			]
		);
		Propagate::run( $variation_id );

		$this->assertStringNotContainsString( 'Updated', get_post( $instance_id )->post_content );
	}

	public function test_instance_only_attrs_survive_the_rebake(): void {
		$variation_id = $this->create_variation( 'Original', 3 );
		// className is an excluded attr: it never propagates, and the merge
		// must keep the instance's own value.
		$instance_id = $this->create_instance(
			$variation_id,
			[ 'className' => 'my-instance-class' ]
		);

		$this->update_variation( $variation_id, 'Updated', 2 );
		Propagate::run( $variation_id );

		$content = get_post( $instance_id )->post_content;
		$this->assertStringContainsString( 'Updated', $content );
		$this->assertStringContainsString( 'my-instance-class', $content );
	}
}
