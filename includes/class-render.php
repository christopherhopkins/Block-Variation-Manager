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

		// Type-mismatched link (block transform, hand-edited markup, retyped
		// variation): merging another block type's attrs would feed foreign
		// values into this block's render. Propagate::walk applies the same
		// name check before touching anything.
		$block_name = (string) ( $parsed_block['blockName'] ?? '' );
		$target     = CPT::get_block_type( $variation_id );
		if ( null !== $target && $block_name !== $target ) {
			return $parsed_block;
		}

		$overridden = [];
		if ( isset( $attrs['bvmOverriddenAttrs'] ) && is_array( $attrs['bvmOverriddenAttrs'] ) ) {
			$overridden = array_flip( $attrs['bvmOverriddenAttrs'] );
		}

		// Excluded attrs are stripped when meta is written, but meta rows
		// written before that rule (or by third parties) may still carry
		// per-instance identity keys — never force those onto instances.
		$excluded = array_flip( Attributes::excluded_attrs() );

		foreach ( $variation_attrs as $key => $value ) {
			if ( isset( $overridden[ $key ] ) || isset( $excluded[ $key ] ) ) {
				continue;
			}
			$attrs[ $key ] = $value;
		}

		$parsed_block['attrs'] = $attrs;
		return $parsed_block;
	}
}
