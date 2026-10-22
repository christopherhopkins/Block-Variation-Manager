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

	/**
	 * Hard ceiling for a stored attrs/inner-blocks JSON payload. Variation
	 * presets are block attribute sets — real ones are a few KB; anything near
	 * this size is abuse or a runaway client.
	 */
	public const MAX_JSON_BYTES = 262144; // 256 KB

	/**
	 * Sanitize a preset/inner-tree value written on behalf of the current
	 * user (SEC-1/SEC-4): attr values are later merged into OTHER users'
	 * blocks at render and baked into their posts by cron, so they must obey
	 * the writer's own content rules. String leaves pass through wp_kses_post
	 * unless the writer has unfiltered_html; keys and non-strings pass
	 * through (they are consumed as data, and excluded keys are stripped
	 * separately at every write path per §9.7).
	 *
	 * @param mixed $value
	 * @return mixed
	 */
	public static function sanitize_untrusted( $value ) {
		if ( current_user_can( 'unfiltered_html' ) ) {
			return $value;
		}
		if ( is_string( $value ) ) {
			return wp_kses_post( $value );
		}
		if ( is_array( $value ) ) {
			foreach ( $value as $k => $v ) {
				$value[ $k ] = self::sanitize_untrusted( $v );
			}
		}
		return $value;
	}

	/**
	 * register_post_meta sanitize_callback for the JSON meta written through
	 * the core /wp/v2 route (which bypasses the bvm/v1 sanitizers): enforce
	 * the size cap, valid JSON, and the same kses rules as sanitize_untrusted.
	 * Invalid or oversized payloads collapse to an empty object rather than
	 * storing garbage.
	 *
	 * @param mixed $value
	 * @return string
	 */
	public static function sanitize_json_meta( $value ): string {
		if ( ! is_string( $value ) || '' === $value ) {
			return '';
		}
		if ( strlen( $value ) > self::MAX_JSON_BYTES ) {
			return '';
		}
		$decoded = json_decode( $value, true );
		if ( null === $decoded && 'null' !== trim( $value ) ) {
			return '';
		}
		return (string) wp_json_encode( self::sanitize_untrusted( $decoded ) );
	}
}
