<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

/**
 * Generic per-block-type policy lookup driven by the WP block type registry.
 *
 * One fact informs the variation system today:
 *
 *   - required_children: block types that declare this block as their
 *     `parent`. The variation must capture its inner block tree on save
 *     (otherwise required children disappear) and restore it on insert/apply.
 *
 * Built lazily on first read so all block types have registered. Entries are
 * filterable per block via `bvm/block_policy` (applied when the registry is
 * served over REST).
 */
class BlockRegistry {

	/**
	 * Vendor relationships the block.json `parent` pass cannot discover:
	 * these children do not declare a server-side `parent`, but the parent
	 * block is meaningless without them, so variations of the parent MUST
	 * capture them into their inner-block template. Merged into the derived
	 * map in build() (only when the parent type is actually registered);
	 * adjustable per block via the `bvm/block_policy` filter.
	 *
	 * @var array<string,array<int,string>>
	 */
	private const DEFAULT_REQUIRED_CHILDREN = [
		// Kadence Row Layout: columns are its structural children (the
		// flagship layout-preset use case), but kadence/column does not
		// declare `parent` in its server registration, so the derived
		// pass never links them.
		'kadence/rowlayout' => [ 'kadence/column' ],
	];

	/** @var array<string,array{required_children:array<int,string>}>|null */
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

	/**
	 * Only entries that carry information: with 300+ registered types the
	 * full map is ~95% empty rows shipped to every editor session. The JS
	 * mirror defaults missing entries to "no required children".
	 *
	 * @return array<string,array{required_children:array<int,string>}>
	 */
	public static function rest_get_registry(): array {
		$out = [];
		foreach ( self::all() as $name => $entry ) {
			$entry = (array) apply_filters( 'bvm/block_policy', $entry, $name );
			if ( ! empty( $entry['required_children'] ) ) {
				$out[ $name ] = $entry;
			}
		}
		return $out;
	}

	/** @return array<string,array{required_children:array<int,string>}> */
	public static function all(): array {
		if ( null === self::$map ) {
			self::build();
		}
		return self::$map ?? [];
	}

	/**
	 * The first declared parent of a child-only block, or null if the block
	 * is allowed at the root. Drives the variation post_content wrapper so
	 * the editor can render child-only blocks like kadence/singlebtn or
	 * core/list-item without "block not allowed here" errors.
	 *
	 * Returns the FIRST entry in $type->parent — block.json `parent` is an
	 * array of allowed parents. We pick a single one to keep the wrapper
	 * deterministic; for multi-parent blocks (rare) it doesn't matter which.
	 */
	public static function parent_of( string $block_name ): ?string {
		if ( ! class_exists( '\\WP_Block_Type_Registry' ) ) {
			return null;
		}
		$registry = \WP_Block_Type_Registry::get_instance();
		if ( ! $registry ) {
			return null;
		}
		$type = $registry->get_registered( $block_name );
		if ( ! $type ) {
			return null;
		}
		$parents = $type->parent ?? null;
		if ( ! is_array( $parents ) || empty( $parents ) ) {
			return null;
		}
		foreach ( $parents as $candidate ) {
			if ( is_string( $candidate ) && '' !== $candidate ) {
				return $candidate;
			}
		}
		return null;
	}

	/**
	 * The chain of synthetic parents needed to place $block_type at the
	 * editor root, outermost first and ending with $block_type itself.
	 * Root-capable blocks return [ $block_type ]. This is the single source
	 * of truth for the wrapper structure: Rest::wrap_for_editing builds
	 * post_content from it, Assets localizes it, and the variation editor's
	 * root enforcement (source/admin/variation-editor.js) validates against
	 * its outermost entry — all three MUST agree or the editor would treat
	 * a legitimate wrapper as a wrong-type root and destroy the variation.
	 *
	 * Depth-capped: real-world hierarchies are 1-2 deep; the visited set
	 * guards against pathological parent cycles.
	 *
	 * @return array<int,string>
	 */
	public static function wrapper_chain( string $block_type ): array {
		$chain   = [ $block_type ];
		$visited = [ $block_type => true ];
		$current = $block_type;
		for ( $depth = 0; $depth < 8; $depth++ ) {
			$parent = self::parent_of( $current );
			if ( null === $parent || isset( $visited[ $parent ] ) ) {
				break;
			}
			array_unshift( $chain, $parent );
			$visited[ $parent ] = true;
			$current            = $parent;
		}
		return $chain;
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

		// Walk each block's `parent` declaration and register it as a
		// required child of every parent it names. This is what makes
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
					self::$map[ $parent_name ] = [ 'required_children' => [] ];
				}
				if ( ! in_array( $name, self::$map[ $parent_name ]['required_children'], true ) ) {
					self::$map[ $parent_name ]['required_children'][] = $name;
				}
			}
		}

		// Seed vendor defaults the `parent` pass cannot see — skipped when
		// the vendor plugin isn't active (parent type unregistered).
		foreach ( self::DEFAULT_REQUIRED_CHILDREN as $parent_name => $children ) {
			if ( ! isset( $all[ $parent_name ] ) ) {
				continue;
			}
			if ( ! isset( self::$map[ $parent_name ] ) ) {
				self::$map[ $parent_name ] = [ 'required_children' => [] ];
			}
			foreach ( $children as $child ) {
				if ( ! in_array( $child, self::$map[ $parent_name ]['required_children'], true ) ) {
					self::$map[ $parent_name ]['required_children'][] = $child;
				}
			}
		}
	}
}
