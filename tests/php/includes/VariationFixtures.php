<?php
/**
 * Shared variation fixtures (QUA-18) — loaded from tests/php/bootstrap.php.
 * One place to make a change like QUA-1's hostile-content fixtures apply
 * everywhere.
 */

use BVM\CPT;
use BVM\Propagate;

trait VariationFixtures {

	/** Serialized core/heading block. */
	protected function heading_block( array $attrs, string $text, int $level = 3 ): string {
		$json = empty( $attrs ) ? '' : ' ' . wp_json_encode( $attrs );
		return sprintf(
			'<!-- wp:heading%s --><h%2$d class="wp-block-heading">%3$s</h%2$d><!-- /wp:heading -->',
			$json,
			$level,
			$text
		);
	}

	/**
	 * A published heading variation with content, synced meta, and the
	 * propagation snapshot seeded — the state REST create leaves behind.
	 */
	protected function create_heading_variation( string $text = 'Original', int $level = 3 ): int {
		$variation_id = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_title'   => 'Heading variation',
				'post_content' => $this->heading_block( [ 'level' => $level ], $text, $level ),
			]
		);
		update_post_meta( $variation_id, BVM_META_BLOCK_TYPE, 'core/heading' );
		CPT::sync_attrs_from_content( $variation_id, get_post( $variation_id ) );
		Propagate::write_snapshot( $variation_id );
		return $variation_id;
	}

	/** A published post whose heading instance links the variation. */
	protected function create_heading_instance( int $variation_id, array $extra_attrs = [], string $text = 'Original', int $level = 3 ): int {
		$attrs = array_merge( [ 'level' => $level, 'bvmVariationId' => $variation_id ], $extra_attrs );
		return self::factory()->post->create(
			[
				'post_type'    => 'post',
				'post_status'  => 'publish',
				'post_content' => $this->heading_block( $attrs, $text, $level ),
			]
		);
	}

	/** Rewrite the variation's content (fires the save hooks). */
	protected function update_heading_variation( int $variation_id, string $text, int $level ): void {
		wp_update_post(
			[
				'ID'           => $variation_id,
				'post_content' => $this->heading_block( [ 'level' => $level ], $text, $level ),
			]
		);
	}

	/** Meta-only variation (no content) — for Render/Inserter-style tests. */
	protected function create_meta_variation( array $attrs, string $block_type = 'core/heading', string $title = 'Meta variation' ): int {
		$variation_id = self::factory()->post->create(
			[
				'post_type'   => BVM_CPT,
				'post_status' => 'publish',
				'post_title'  => $title,
			]
		);
		update_post_meta( $variation_id, BVM_META_BLOCK_TYPE, $block_type );
		update_post_meta( $variation_id, BVM_META_ATTRS, wp_slash( wp_json_encode( $attrs ) ) );
		return $variation_id;
	}
}
