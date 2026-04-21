<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

/**
 * Injects bvmVariationId + bvmOverriddenAttrs onto every registered block
 * so they're serialized into post_content alongside native attributes.
 */
class Attributes {
	public static function init(): void {
		add_filter( 'register_block_type_args', [ self::class, 'extend' ], 10, 2 );
	}

	/**
	 * @param array<string,mixed> $args
	 */
	public static function extend( array $args, string $block_name ): array {
		if ( ! isset( $args['attributes'] ) || ! is_array( $args['attributes'] ) ) {
			$args['attributes'] = [];
		}

		$args['attributes']['bvmVariationId'] = [
			'type'    => 'number',
			'default' => 0,
		];

		$args['attributes']['bvmOverriddenAttrs'] = [
			'type'    => 'array',
			'default' => [],
			'items'   => [ 'type' => 'string' ],
		];

		return $args;
	}
}
