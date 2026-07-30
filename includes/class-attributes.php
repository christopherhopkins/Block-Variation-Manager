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

	/**
	 * Attribute keys that must never be part of a variation preset: BVM
	 * bookkeeping, per-instance identity (className, anchor, Kadence
	 * uniqueID), and editor plumbing. Mirrors INTERNAL_ATTRS in
	 * source/constants.js — a preset containing these would force one
	 * instance's identity onto every other instance at render time.
	 * Filterable so vendor adapters can add their own identity attrs.
	 *
	 * @return array<int,string>
	 */
	public static function excluded_attrs(): array {
		$defaults = [
			'bvmVariationId',
			'bvmOverriddenAttrs',
			'className',
			'anchor',
			'lock',
			'metadata',
			// Kadence per-instance identity: sharing one uniqueID across
			// instances breaks its request-time CSS selector matching.
			'uniqueID',
			'uniqueId',
		];
		return (array) apply_filters( 'bvm_excluded_attrs', $defaults );
	}

	/**
	 * @param array<string,mixed> $attrs
	 * @return array<string,mixed>
	 */
	public static function strip_excluded( array $attrs ): array {
		foreach ( self::excluded_attrs() as $key ) {
			unset( $attrs[ $key ] );
		}
		return $attrs;
	}
}
