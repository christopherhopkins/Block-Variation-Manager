<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

/**
 * Per-user onboarding-tour completion state.
 *
 * One user-meta key holds a map of `tourId => true`. The JS tour runtime
 * reads the map (localized at enqueue time) and writes it through the core
 * `/wp/v2/users/me` endpoint — there is no custom REST route and no PHP
 * write path, so §9.1 slashing has no call site here (core's meta-fields
 * controller owns the write).
 */
class Tours {
	public const META_KEY = 'bvm_tours_completed';

	/**
	 * Upper bound on stored flags — the map only ever holds the plugin's
	 * few tour ids; the cap keeps a misbehaving client from growing the
	 * meta unbounded.
	 */
	public const MAX_TOURS = 16;

	public static function init(): void {
		add_action( 'init', [ self::class, 'register_meta' ] );
	}

	public static function register_meta(): void {
		register_meta(
			'user',
			self::META_KEY,
			[
				'type'              => 'object',
				'single'            => true,
				'default'           => [],
				'sanitize_callback' => [ self::class, 'sanitize' ],
				'auth_callback'     => [ self::class, 'auth' ],
				'show_in_rest'      => [
					'schema' => [
						'type'                 => 'object',
						'additionalProperties' => [ 'type' => 'boolean' ],
					],
				],
			]
		);
	}

	/**
	 * Keep only `tour-id => true` entries with slug-safe keys.
	 *
	 * @param mixed $value Raw meta value.
	 * @return array<string,bool>
	 */
	public static function sanitize( $value ): array {
		if ( ! is_array( $value ) && ! is_object( $value ) ) {
			return [];
		}
		$out = [];
		foreach ( (array) $value as $tour_id => $completed ) {
			if ( count( $out ) >= self::MAX_TOURS ) {
				break;
			}
			if ( ! is_string( $tour_id ) || ! preg_match( '/^[a-z0-9_-]+$/i', $tour_id ) ) {
				continue;
			}
			if ( ! $completed ) {
				// Only completion is stored; absence means "not seen".
				continue;
			}
			$out[ $tour_id ] = true;
		}
		return $out;
	}

	/**
	 * Users may edit only their own tour state.
	 *
	 * @param bool   $allowed   Current decision.
	 * @param string $meta_key  Meta key being written.
	 * @param int    $object_id User the meta is written to.
	 * @param int    $user_id   Acting user.
	 * @return bool
	 */
	public static function auth( $allowed, $meta_key, $object_id, $user_id ): bool {
		return (int) $object_id === (int) $user_id && $user_id > 0;
	}
}
