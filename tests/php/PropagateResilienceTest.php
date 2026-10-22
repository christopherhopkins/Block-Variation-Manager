<?php
/**
 * Review-track regressions for the propagation chain's failure modes:
 * COR-1 (interrupted runs), COR-2 (partial: re-processed batches), COR-7
 * (duplicate skipped rows), COR-D3 (stale skipped rows after a channel
 * change), SEC-2 (kses window restoration), and QUA-2's batch-continuation
 * coverage.
 *
 * @covers \BVM\Propagate
 */

use BVM\CPT;
use BVM\Propagate;

class PropagateResilienceTest extends WP_UnitTestCase {

	private function heading_block( array $attrs, string $text, int $level = 3 ): string {
		$json = empty( $attrs ) ? '' : ' ' . wp_json_encode( $attrs );
		return sprintf(
			'<!-- wp:heading%s --><h%2$d class="wp-block-heading">%3$s</h%2$d><!-- /wp:heading -->',
			$json,
			$level,
			$text
		);
	}

	private function create_variation( string $text = 'Original', int $level = 3 ): int {
		$variation_id = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_title'   => 'Resilience variation',
				'post_content' => $this->heading_block( [ 'level' => $level ], $text, $level ),
			]
		);
		update_post_meta( $variation_id, BVM_META_BLOCK_TYPE, 'core/heading' );
		CPT::sync_attrs_from_content( $variation_id, get_post( $variation_id ) );
		Propagate::write_snapshot( $variation_id );
		return $variation_id;
	}

	private function create_instance( int $variation_id, string $text = 'Original', int $level = 3 ): int {
		return self::factory()->post->create(
			[
				'post_status'  => 'publish',
				'post_content' => $this->heading_block(
					[ 'level' => $level, 'bvmVariationId' => $variation_id ],
					$text,
					$level
				),
			]
		);
	}

	private function update_variation( int $variation_id, string $text, int $level ): void {
		wp_update_post(
			[
				'ID'           => $variation_id,
				'post_content' => $this->heading_block( [ 'level' => $level ], $text, $level ),
			]
		);
	}

	/**
	 * COR-1: an instance that already carries the CURRENT source (because an
	 * interrupted run rewrote it before dying, and the batch re-ran) is up to
	 * date — it must be neither flagged diverged nor rewritten.
	 */
	public function test_instance_matching_current_source_is_in_sync(): void {
		$vid = $this->create_variation( 'Original', 3 );

		// Simulate the interrupted-run aftermath: the variation moved to v2,
		// the snapshot still describes v1, and this instance was already
		// rewritten to v2 before the crash.
		$this->update_variation( $vid, 'Version two', 2 );
		$instance = $this->create_instance( $vid, 'Version two', 2 );

		Propagate::run( $vid );

		$this->assertArrayNotHasKey(
			$vid,
			(array) get_option( Propagate::SKIPPED_OPT, [] ),
			'An instance matching the current source must not be reported diverged (COR-1).'
		);
		$this->assertStringContainsString( 'Version two', get_post( $instance )->post_content );
	}

	/**
	 * COR-1: the continuation event exists BEFORE the batch is processed, so
	 * a mid-batch fatal cannot kill the chain. Observed via a save_post hook
	 * that fires while the first instance of a full batch is being rewritten.
	 */
	public function test_continuation_is_scheduled_before_batch_processing(): void {
		$vid = $this->create_variation( 'Original', 3 );
		$ids = [];
		// A full batch plus one: BATCH_SIZE instances means a continuation.
		for ( $i = 0; $i < Propagate::BATCH_SIZE + 1; $i++ ) {
			$ids[] = $this->create_instance( $vid );
		}
		$this->update_variation( $vid, 'Updated', 2 );

		$seen = [];
		$spy  = function ( $post_id ) use ( &$seen, $vid ) {
			// First instance write of the run: the continuation for this
			// batch's cursor must already be queued.
			$events = _get_cron_array();
			foreach ( $events as $hooks ) {
				if ( isset( $hooks[ Propagate::HOOK ] ) ) {
					foreach ( $hooks[ Propagate::HOOK ] as $event ) {
						$seen[] = $event['args'];
					}
				}
			}
		};
		add_action( 'save_post', $spy, 1, 1 );
		try {
			Propagate::run( $vid );
		} finally {
			remove_action( 'save_post', $spy, 1 );
		}

		$cursors = array_unique( array_map( static fn( $args ) => $args[1] ?? null, $seen ) );
		$this->assertNotEmpty(
			array_filter( $cursors, static fn( $c ) => null !== $c && $c > 0 ),
			'A continuation with a non-zero cursor must be queued before instances are written (COR-1).'
		);
	}

	/** QUA-2: a multi-batch run converges every instance across continuations. */
	public function test_multi_batch_run_updates_all_instances(): void {
		$vid = $this->create_variation( 'Original', 3 );
		$ids = [];
		for ( $i = 0; $i < Propagate::BATCH_SIZE + 3; $i++ ) {
			$ids[] = $this->create_instance( $vid );
		}
		$this->update_variation( $vid, 'Converged', 2 );

		// Drain the chain the way cron would.
		Propagate::run( $vid, 0 );
		$guard = 0;
		while ( $guard++ < 5 ) {
			$next = null;
			foreach ( _get_cron_array() as $hooks ) {
				foreach ( $hooks[ Propagate::HOOK ] ?? [] as $sig => $event ) {
					$next = $event['args'];
					break 2;
				}
			}
			if ( null === $next ) {
				break;
			}
			wp_clear_scheduled_hook( Propagate::HOOK, $next );
			Propagate::run( ...$next );
		}

		foreach ( $ids as $instance ) {
			$this->assertStringContainsString( 'Converged', get_post( $instance )->post_content );
		}
		// Snapshot advanced to the new source after the final batch (§9.5).
		$this->assertStringContainsString(
			'Converged',
			(string) get_post_meta( $vid, BVM_META_PROPAGATED_SOURCE, true )
		);
	}

	/** COR-7: double-running the same cursor must not duplicate skipped rows. */
	public function test_double_run_does_not_duplicate_skipped_rows(): void {
		$vid      = $this->create_variation( 'Original', 3 );
		$instance = $this->create_instance( $vid, 'Hand edited', 3 );
		$this->update_variation( $vid, 'Updated', 2 );

		Propagate::run( $vid );
		Propagate::run( $vid ); // §9.14's parallel-runner double execution.

		$rows = get_option( Propagate::SKIPPED_OPT, [] )[ $vid ] ?? [];
		$this->assertCount( 1, $rows );
		$this->assertSame( $instance, $rows[0]['id'] );
	}

	/**
	 * COR-D3: when a variation loses its bake/inner reason (reclassified to
	 * the attrs-only channel), the early exit must clear its stale rows.
	 */
	public function test_attrs_only_early_exit_clears_stale_skipped_rows(): void {
		$vid = $this->create_variation( 'Original', 3 );
		update_option(
			Propagate::SKIPPED_OPT,
			[ $vid => [ [ 'id' => 123, 'title' => 'stale', 'edit_link' => '', 'permalink' => '', 'overrides' => [] ] ] ],
			false
		);

		// Force the attrs-only channel for core/heading.
		add_filter( 'bvm_block_needs_bake', '__return_false' );
		try {
			Propagate::run( $vid );
		} finally {
			remove_filter( 'bvm_block_needs_bake', '__return_false' );
		}

		$this->assertArrayNotHasKey( $vid, (array) get_option( Propagate::SKIPPED_OPT, [] ) );
	}

	/** SEC-2: a throwing save_post hook must not leave kses suspended. */
	public function test_kses_window_is_restored_after_a_throwing_hook(): void {
		$vid      = $this->create_variation( 'Original', 3 );
		$instance = $this->create_instance( $vid );
		$this->update_variation( $vid, 'Updated', 2 );

		// kses filters are active for the anonymous (cron) user.
		kses_init();
		$this->assertNotFalse( has_filter( 'content_save_pre', 'wp_filter_post_kses' ) );

		$bomb = static function () {
			throw new RuntimeException( 'third-party save hook exploded' );
		};
		add_action( 'save_post', $bomb, 99 );
		try {
			Propagate::run( $vid );
			$this->fail( 'Expected the hook exception to propagate.' );
		} catch ( RuntimeException $e ) {
			// expected
		} finally {
			remove_action( 'save_post', $bomb, 99 );
		}

		$this->assertNotFalse(
			has_filter( 'content_save_pre', 'wp_filter_post_kses' ),
			'kses must be re-initialized even when a hook inside the window throws (SEC-2).'
		);
	}
}
