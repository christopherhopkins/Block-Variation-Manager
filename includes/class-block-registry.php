<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

/**
 * Generic per-block-type policy lookup driven by the WP block type registry.
 *
 * Two facts inform the variation system:
 *
 *   - has_required_children: any registered block type declares this block as
 *     its `parent`. The variation must capture its inner block tree on save
 *     (otherwise required children disappear) and restore it on insert/apply.
 *
 *   - is_preset_capable: the block type exposes a `showPresets` attribute
 *     (Kadence's "Quick Layout Presets" convention). Used today only as a
 *     hint for the editor UI; the preset-attr-loss bug itself is fixed in
 *     CPT::sync_attrs_from_content.
 *
 * Built lazily on first read after `init` priority 20 so all block types
 * have registered. Filterable per block via `bvm/block_policy`.
 */
class BlockRegistry {

	/** @var array<string,array{required_children:array<int,string>,preset_capable:bool}>|null */
	private static $map = null;

	public static function init(): void {
		add_action( 'rest_api_init', [ self::class, 'register_route' ] );
	}

	public static function register_route(): void {
		register_rest_route(
			Rest::NAMESPACE,
			'/registry',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ self::class, 'rest_get_registry' ],
				'permission_callback' => [ Rest::class, 'can_read' ],
			]
		);
	}

	public static function rest_get_registry(): array {
		return self::all();
	}

	/** @return array<string,array{required_children:array<int,string>,preset_capable:bool}> */
	public static function all(): array {
		if ( null === self::$map ) {
			self::build();
		}
		return self::$map ?? [];
	}

	public static function has_required_children( string $block_name ): bool {
		$entry = self::entry( $block_name );
		return ! empty( $entry['required_children'] );
	}

	/** @return array<int,string> */
	public static function required_children( string $block_name ): array {
		$entry = self::entry( $block_name );
		return $entry['required_children'] ?? [];
	}

	public static function is_preset_capable( string $block_name ): bool {
		$entry = self::entry( $block_name );
		return ! empty( $entry['preset_capable'] );
	}

	/** @return array{required_children:array<int,string>,preset_capable:bool} */
	private static function entry( string $block_name ): array {
		$map = self::all();
		$entry = $map[ $block_name ] ?? [
			'required_children' => [],
			'preset_capable'    => false,
		];
		return apply_filters( 'bvm/block_policy', $entry, $block_name );
	}

	private static function build(): void {
		self::$map = [];
		if ( ! class_exists( '\\WP_Block_Type_Registry' ) ) {
			return;
		}
		$registry = \WP_Block_Type_Registry::get_instance();
		if ( ! $registry ) {
			return;
		}
		$all = $registry->get_all_registered();

		// First pass: ensure every block has an entry; detect preset capability.
		foreach ( $all as $name => $type ) {
			$attrs = is_array( $type->attributes ?? null ) ? $type->attributes : [];
			self::$map[ $name ] = [
				'required_children' => [],
				'preset_capable'    => array_key_exists( 'showPresets', $attrs ),
			];
		}

		// Second pass: walk each block's `parent` declaration and register it
		// as a required child of every parent it names. This is what makes
		// kadence/pane a required child of kadence/accordion, kadence/singlebtn
		// of kadence/advancedbtn, kadence/tab of kadence/tabs, etc.
		foreach ( $all as $name => $type ) {
			$parents = $type->parent ?? null;
			if ( ! is_array( $parents ) || empty( $parents ) ) {
				continue;
			}
			foreach ( $parents as $parent_name ) {
				if ( ! is_string( $parent_name ) || '' === $parent_name ) {
					continue;
				}
				if ( ! isset( self::$map[ $parent_name ] ) ) {
					self::$map[ $parent_name ] = [
						'required_children' => [],
						'preset_capable'    => false,
					];
				}
				if ( ! in_array( $name, self::$map[ $parent_name ]['required_children'], true ) ) {
					self::$map[ $parent_name ]['required_children'][] = $name;
				}
			}
		}
	}
}
