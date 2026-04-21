<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

/**
 * Merge variation attributes into a block's attrs at render time.
 *
 * Precedence (highest wins):
 *   1. Attributes listed in bvmOverriddenAttrs — the user manually changed these.
 *      Instance value wins, even if the variation has a value.
 *   2. Attributes from the variation definition — win over whatever the instance
 *      currently has baked into post_content. This is what makes edits propagate:
 *      the instance may have stale values from when it was inserted, but we
 *      overwrite them at render time with whatever the variation currently says.
 *   3. Instance value — used as a fallback when the variation doesn't define the key.
 */
class Render {
	public static function init(): void {
		add_filter( 'render_block_data', [ self::class, 'apply_variation' ], 10, 1 );
	}

	/**
	 * @param array<string,mixed> $parsed_block
	 * @return array<string,mixed>
	 */
	public static function apply_variation( array $parsed_block ): array {
		$attrs = $parsed_block['attrs'] ?? [];
		if ( ! is_array( $attrs ) ) {
			return $parsed_block;
		}

		$variation_id = isset( $attrs['bvmVariationId'] ) ? (int) $attrs['bvmVariationId'] : 0;
		if ( $variation_id <= 0 ) {
			return $parsed_block;
		}

		$variation_attrs = CPT::get_attrs( $variation_id );
		if ( null === $variation_attrs || [] === $variation_attrs ) {
			return $parsed_block;
		}

		$overridden = [];
		if ( isset( $attrs['bvmOverriddenAttrs'] ) && is_array( $attrs['bvmOverriddenAttrs'] ) ) {
			$overridden = array_flip( $attrs['bvmOverriddenAttrs'] );
		}

		foreach ( $variation_attrs as $key => $value ) {
			if ( isset( $overridden[ $key ] ) ) {
				continue;
			}
			$attrs[ $key ] = $value;
		}

		$parsed_block['attrs'] = $attrs;
		return $parsed_block;
	}
}
