<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

class CPT {
	public static function init(): void {
		add_action( 'init', [ self::class, 'register' ] );
		add_action( 'save_post_' . BVM_CPT, [ self::class, 'sync_attrs_from_content' ], 10, 2 );
		add_filter( 'manage_' . BVM_CPT . '_posts_columns', [ self::class, 'list_columns' ] );
		add_action( 'manage_' . BVM_CPT . '_posts_custom_column', [ self::class, 'render_list_column' ], 10, 2 );
		// The block editor's title placeholder flows through this filter
		// (edit-form-blocks.php feeds it into the editor settings), so no
		// DOM trickery is needed to rename it on the variation screen.
		add_filter( 'enter_title_here', [ self::class, 'title_placeholder' ], 10, 2 );
	}

	public static function title_placeholder( string $text, \WP_Post $post ): string {
		return BVM_CPT === $post->post_type
			? __( 'Variation name', 'block-variation-manager' )
			: $text;
	}

	/** @param array<string,string> $columns */
	public static function list_columns( array $columns ): array {
		$insert = [
			'bvm_block_type' => __( 'Block', 'block-variation-manager' ),
			'bvm_usage'      => __( 'Pages', 'block-variation-manager' ),
		];
		// Insert after the title column.
		$out = [];
		foreach ( $columns as $key => $label ) {
			$out[ $key ] = $label;
			if ( 'title' === $key ) {
				$out = array_merge( $out, $insert );
			}
		}
		return $out;
	}

	public static function render_list_column( string $column, int $post_id ): void {
		if ( 'bvm_block_type' === $column ) {
			echo esc_html( (string) ( self::get_block_type( $post_id ) ?? '—' ) );
		}
		if ( 'bvm_usage' === $column ) {
			$n = self::count_usage( $post_id );
			echo esc_html( (string) $n );
		}
	}

	/**
	 * After a variation post is saved, parse its first block out of
	 * post_content and mirror its attributes (and inner-block tree) into meta.
	 * The meta is what the render-time merge (class-render.php) and the
	 * editor-side variation registration (class-inserter.php) read.
	 *
	 * parse_blocks() only returns comment-serialized attrs: values that equal
	 * a CLIENT-registered default (Kadence preset attrs missing from the
	 * server's block.json) and html-sourced attrs (heading/button text) never
	 * appear in the comment. Rebuilding meta from a parse alone therefore
	 * silently dropped those keys — including on Quick Edit renames. Two
	 * mechanisms compensate:
	 *
	 *   1. The existing meta is layered as a baseline on EVERY save (parsed
	 *      values + registered defaults win on overlapping keys).
	 *   2. The variation editor bundle refreshes the meta wholesale with the
	 *      editor's fully-resolved attr set after each successful save (see
	 *      source/admin/variation-editor.js), which also purges stale keys
	 *      the baseline would otherwise carry forward.
	 *
	 * Also captures the root block's inner blocks as a tuple template
	 * ([name, attrs, innerBlocks]) so the inserter can pre-populate each
	 * instance with the variation's structure, and auto-populates the
	 * block_type meta if the user inserted a block but the meta hadn't been
	 * set yet.
	 */
	public static function sync_attrs_from_content( int $post_id, \WP_Post $post ): void {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}

		$content = (string) $post->post_content;
		if ( '' === trim( $content ) ) {
			update_post_meta( $post_id, BVM_META_ATTRS, wp_slash( wp_json_encode( [] ) ) );
			delete_post_meta( $post_id, BVM_META_INNER_BLOCKS );
			return;
		}
		$blocks       = parse_blocks( $content );
		$target       = (string) get_post_meta( $post_id, BVM_META_BLOCK_TYPE, true );
		$used_target  = false;
		$first        = null;

		// When block_type is known, search the parsed tree by name. Lets
		// child-only variations (kadence/singlebtn, core/list-item, …) live
		// wrapped in a synthetic parent in post_content while their meta
		// stays anchored to the real source block.
		if ( '' !== $target ) {
			$first = self::find_block( $blocks, $target );
			if ( null !== $first ) {
				$used_target = true;
			} elseif ( null === BlockRegistry::parent_of( $target ) ) {
				// Root-capable block_type with no by-name match — fall through
				// to the "first non-empty root block" path. Safe because a
				// root-capable block has no wrapper to confuse the meta. This
				// also restores the pre-by-name-search behavior for legacy
				// or hand-edited variations whose meta block_type has drifted.
				$first = null;
			} else {
				// Child-only block_type and the wrapper is broken (user
				// deleted the child, moved it out, etc.). Don't overwrite
				// meta with the wrapper's attrs — preserve what we had so a
				// save typo can't silently nuke the variation's contents.
				return;
			}
		}

		// Fallback: brand-new variation whose block_type meta isn't set yet,
		// or pre-by-name-search legacy data — take the first non-empty block
		// at the root.
		if ( null === $first ) {
			foreach ( $blocks as $b ) {
				if ( ! empty( $b['blockName'] ) ) {
					$first = $b;
					break;
				}
			}
		}
		if ( null === $first ) {
			return;
		}

		$parsed_attrs = is_array( $first['attrs'] ?? null ) ? $first['attrs'] : [];
		$attrs        = self::merge_with_defaults( (string) $first['blockName'], $parsed_attrs );

		// Baseline layering (see docblock): parsed + defaults win on
		// overlapping keys; keys that exist only in the stored meta survive.
		// Raw meta read — get_attrs() is publish-gated and this must also
		// work while the post passes through a non-publish status.
		$existing_raw = get_post_meta( $post_id, BVM_META_ATTRS, true );
		$existing     = is_string( $existing_raw ) && '' !== $existing_raw
			? json_decode( $existing_raw, true )
			: [];
		$existing     = is_array( $existing ) ? $existing : [];
		$attrs        = Attributes::strip_excluded( array_merge( $existing, $attrs ) );
		// wp_slash: update_post_meta unslashes its value, which would strip
		// the backslashes wp_json_encode emits for quotes/unicode and corrupt
		// the stored JSON.
		update_post_meta( $post_id, BVM_META_ATTRS, wp_slash( wp_json_encode( $attrs ) ) );

		$inner_tuples = self::blocks_to_tuples( is_array( $first['innerBlocks'] ?? null ) ? $first['innerBlocks'] : [] );
		if ( ! empty( $inner_tuples ) ) {
			update_post_meta( $post_id, BVM_META_INNER_BLOCKS, wp_slash( wp_json_encode( $inner_tuples ) ) );
		} else {
			delete_post_meta( $post_id, BVM_META_INNER_BLOCKS );
		}

		// Only auto-populate block_type when we used the fallback path.
		// When we matched by-name, $target already equals $first['blockName']
		// by construction, so writing it back is a no-op. Skipping the write
		// also avoids accidentally re-asserting a stale block_type if a future
		// caller passes a wrapper block via the fallback.
		if ( ! $used_target ) {
			$existing_block_type = get_post_meta( $post_id, BVM_META_BLOCK_TYPE, true );
			if ( ! $existing_block_type ) {
				update_post_meta( $post_id, BVM_META_BLOCK_TYPE, $first['blockName'] );
			}
		}
	}

	/**
	 * Depth-first search of a parse_blocks() tree for the first block
	 * whose blockName matches $block_name. Used by the variation save
	 * sync to locate the canonical source block when post_content contains
	 * a synthetic wrapper (child-only variations) rather than placing the
	 * source at the root.
	 *
	 * @param array<int,array<string,mixed>> $blocks
	 * @return array<string,mixed>|null
	 */
	public static function find_block( array $blocks, string $block_name ): ?array {
		if ( '' === $block_name ) {
			return null;
		}
		foreach ( $blocks as $b ) {
			if ( ! empty( $b['blockName'] ) && $b['blockName'] === $block_name ) {
				return $b;
			}
			if ( isset( $b['innerBlocks'] ) && is_array( $b['innerBlocks'] ) && ! empty( $b['innerBlocks'] ) ) {
				$nested = self::find_block( $b['innerBlocks'], $block_name );
				if ( null !== $nested ) {
					return $nested;
				}
			}
		}
		return null;
	}

	/**
	 * Merge `parse_blocks()` attrs with the block type's registered defaults.
	 *
	 * `parse_blocks()` returns only attrs that were serialized into the block
	 * comment — i.e. attrs whose value differs from the block.json default.
	 * For "apply variation to existing block" to work, the variation needs
	 * the FULL effective attr set so default-equal preset attrs can be
	 * written back on top of an existing block's non-default values.
	 *
	 * @param array<string,mixed> $attrs
	 * @return array<string,mixed>
	 */
	public static function merge_with_defaults( string $block_name, array $attrs ): array {
		if ( '' === $block_name || ! class_exists( '\\WP_Block_Type_Registry' ) ) {
			return $attrs;
		}
		$registry   = \WP_Block_Type_Registry::get_instance();
		$block_type = $registry ? $registry->get_registered( $block_name ) : null;
		if ( ! $block_type || ! is_array( $block_type->attributes ?? null ) ) {
			return $attrs;
		}
		$defaults = [];
		foreach ( $block_type->attributes as $name => $schema ) {
			if ( is_array( $schema ) && array_key_exists( 'default', $schema ) ) {
				$defaults[ $name ] = $schema['default'];
			}
		}
		// Parsed attrs win — they represent intentional non-default values.
		return array_merge( $defaults, $attrs );
	}

	/**
	 * Recursively convert parse_blocks() output into Gutenberg's block-variation
	 * innerBlocks shape: an array of [ name, attrs, innerBlocks ] tuples. Each
	 * node's attrs are merged with the block type's registered defaults so
	 * preset-driven attrs (which match defaults) survive an "apply" round-trip.
	 *
	 * @param array<int,array<string,mixed>> $parsed
	 * @return array<int,array{0:string,1:array<string,mixed>,2:array<int,mixed>}>
	 */
	private static function blocks_to_tuples( array $parsed ): array {
		$out = [];
		foreach ( $parsed as $b ) {
			if ( empty( $b['blockName'] ) ) {
				// Skip freeform / whitespace-only parse_blocks entries.
				continue;
			}
			$name  = (string) $b['blockName'];
			$attrs = is_array( $b['attrs'] ?? null ) ? $b['attrs'] : [];
			$out[] = [
				$name,
				// Strip bookkeeping/identity attrs: a child inside the
				// variation may itself be linked to another variation, and
				// keeping its bvmVariationId here would silently link every
				// template-inserted child to that other variation.
				Attributes::strip_excluded( self::merge_with_defaults( $name, $attrs ) ),
				self::blocks_to_tuples( $b['innerBlocks'] ?? [] ),
			];
		}
		return $out;
	}

	public static function register(): void {
		register_post_type(
			BVM_CPT,
			[
				'labels'              => [
					'name'          => __( 'Block Variations', 'block-variation-manager' ),
					'singular_name' => __( 'Block Variation', 'block-variation-manager' ),
					'add_new'       => __( 'Add New Variation', 'block-variation-manager' ),
					'add_new_item'  => __( 'Add New Block Variation', 'block-variation-manager' ),
					'edit_item'     => __( 'Edit Block Variation', 'block-variation-manager' ),
					'all_items'     => __( 'Block Variations', 'block-variation-manager' ),
				],
				'public'              => false,
				'show_ui'             => true,
				// Nest under Tools rather than polluting the top-level menu —
				// this is a power-user feature for devs/site builders.
				'show_in_menu'        => 'tools.php',
				'show_in_rest'        => true,
				'rest_base'           => 'block-variation-manager',
				'menu_icon'           => 'dashicons-screenoptions',
				// Intentionally no 'custom-fields' — we don't want devs
				// editing the raw _bvm_variation_attrs JSON through the
				// metabox. The meta is synced from post_content on save.
				'supports'            => [ 'title', 'editor' ],
				'capability_type'     => 'post',
				'map_meta_cap'        => true,
				'has_archive'         => false,
				'exclude_from_search' => true,
				'publicly_queryable'  => false,
			]
		);

		register_post_meta(
			BVM_CPT,
			BVM_META_BLOCK_TYPE,
			[
				'type'              => 'string',
				'single'            => true,
				'show_in_rest'      => true,
				'sanitize_callback' => 'sanitize_text_field',
				'auth_callback'     => function () {
					return current_user_can( 'edit_posts' );
				},
			]
		);

		register_post_meta(
			BVM_CPT,
			BVM_META_ATTRS,
			[
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => [
					'schema' => [ 'type' => 'string' ],
				],
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			]
		);

		register_post_meta(
			BVM_CPT,
			BVM_META_INNER_BLOCKS,
			[
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => [
					'schema' => [ 'type' => 'string' ],
				],
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			]
		);
	}

	/**
	 * Fetch the attribute preset for a given variation post.
	 *
	 * @return array<string,mixed>|null
	 */
	public static function get_attrs( int $variation_id ): ?array {
		$post = get_post( $variation_id );
		if ( ! $post || BVM_CPT !== $post->post_type || 'publish' !== $post->post_status ) {
			return null;
		}
		$raw = get_post_meta( $variation_id, BVM_META_ATTRS, true );
		if ( ! is_string( $raw ) || '' === $raw ) {
			return [];
		}
		$decoded = json_decode( $raw, true );
		return is_array( $decoded ) ? $decoded : [];
	}

	public static function get_block_type( int $variation_id ): ?string {
		$value = get_post_meta( $variation_id, BVM_META_BLOCK_TYPE, true );
		return is_string( $value ) && '' !== $value ? $value : null;
	}

	/**
	 * Whether a block type's static HTML needs server-side rebaking when its
	 * variation changes.
	 *
	 * Keyed on the property that actually matters — static save() vs dynamic
	 * render — not a vendor prefix. Static blocks bake attr-derived markup
	 * into post_content, so render_block_data merging is a no-op for them and
	 * only a rebake propagates; dynamic blocks (anything with a
	 * render_callback, which includes Kadence's request-time CSS pipeline and
	 * dynamic core blocks) render from attrs on every request. Blocks
	 * registered only client-side are treated as static — the conservative
	 * default for third-party suites.
	 *
	 * Filter `bvm_block_needs_bake` to include/exclude specific blocks.
	 */
	public static function block_needs_bake( string $block_name ): bool {
		$default = true;
		if ( class_exists( '\\WP_Block_Type_Registry' ) ) {
			$type = \WP_Block_Type_Registry::get_instance()->get_registered( $block_name );
			if ( $type ) {
				$default = ! $type->is_dynamic();
			}
		}
		return (bool) apply_filters( 'bvm_block_needs_bake', $default, $block_name );
	}

	/**
	 * Fetch the variation's inner-block template as [name, attrs, innerBlocks]
	 * tuples, ready to attach to a registered block variation's innerBlocks.
	 *
	 * @return array<int,array{0:string,1:array<string,mixed>,2:array<int,mixed>}>
	 */
	public static function get_inner_blocks( int $variation_id ): array {
		$raw = get_post_meta( $variation_id, BVM_META_INNER_BLOCKS, true );
		if ( ! is_string( $raw ) || '' === $raw ) {
			return [];
		}
		$decoded = json_decode( $raw, true );
		return is_array( $decoded ) ? $decoded : [];
	}

	/**
	 * Shared WHERE fragment + params for "post_content references this
	 * variation id".
	 *
	 * The needle is delimiter-terminated: in serialized block JSON the id is
	 * always followed by ',' or '}', so matching the bare prefix would also
	 * match longer ids (variation 12 hitting "bvmVariationId":123).
	 *
	 * @return array{0:string,1:array<int,string>} [ where_sql, params ]
	 */
	private static function usage_where( int $variation_id ): array {
		global $wpdb;
		$needle = '"bvmVariationId":' . $variation_id;
		$where  = "post_status IN ('publish','draft','pending','future','private')
			 AND post_type NOT IN ('revision', %s)
			 AND (post_content LIKE %s OR post_content LIKE %s)";
		$params = [
			BVM_CPT,
			'%' . $wpdb->esc_like( $needle . ',' ) . '%',
			'%' . $wpdb->esc_like( $needle . '}' ) . '%',
		];
		return [ $where, $params ];
	}

	/**
	 * List posts whose content references a given variation id.
	 *
	 * Admin-only — runs a LIKE against post_content. Defaults match the old
	 * 200-row cap.
	 *
	 * @return array<int,array{id:int,title:string,post_type:string,edit_link:?string,status:string}>
	 */
	public static function list_usage( int $variation_id, int $offset = 0, int $limit = 200 ): array {
		global $wpdb;
		if ( $variation_id <= 0 ) {
			return [];
		}
		list( $where, $params ) = self::usage_where( $variation_id );
		$limit  = max( 1, min( 500, $limit ) );
		$offset = max( 0, $offset );
		$sql    = $wpdb->prepare(
			"SELECT ID, post_title, post_type, post_status FROM {$wpdb->posts}
			 WHERE {$where}
			 ORDER BY post_modified DESC
			 LIMIT %d OFFSET %d",
			array_merge( $params, [ $limit, $offset ] )
		);
		$rows = $wpdb->get_results( $sql );
		$out  = [];
		foreach ( $rows as $row ) {
			$id        = (int) $row->ID;
			$title     = '' !== $row->post_title ? $row->post_title : __( '(no title)', 'block-variation-manager' );
			$permalink = get_permalink( $id );
			$out[]     = [
				'id'        => $id,
				'title'     => $title,
				'post_type' => $row->post_type,
				'status'    => $row->post_status,
				'edit_link' => get_edit_post_link( $id, 'raw' ),
				'permalink' => is_string( $permalink ) && '' !== $permalink ? $permalink : null,
			];
		}
		return $out;
	}

	/**
	 * Count posts whose content references a given variation id.
	 *
	 * Intentionally scoped to the admin — runs a LIKE against post_content.
	 * Fine for a list view that's rarely hit; don't call from frontend paths.
	 */
	public static function count_usage( int $variation_id ): int {
		global $wpdb;
		if ( $variation_id <= 0 ) {
			return 0;
		}
		list( $where, $params ) = self::usage_where( $variation_id );
		$sql = $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->posts} WHERE {$where}",
			$params
		);
		return (int) $wpdb->get_var( $sql );
	}

	/**
	 * Keyset-paged instance IDs for the propagation job: stable under
	 * concurrent edits, unlike OFFSET over post_modified (rows shifting
	 * across the offset boundary between batches skipped instances).
	 *
	 * @return array<int,int> Post IDs > $after_id, ascending.
	 */
	public static function usage_post_ids( int $variation_id, int $after_id = 0, int $limit = 50 ): array {
		global $wpdb;
		if ( $variation_id <= 0 ) {
			return [];
		}
		list( $where, $params ) = self::usage_where( $variation_id );
		$sql = $wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts}
			 WHERE {$where} AND ID > %d
			 ORDER BY ID ASC
			 LIMIT %d",
			array_merge( $params, [ max( 0, $after_id ), max( 1, min( 500, $limit ) ) ] )
		);
		return array_map( 'intval', (array) $wpdb->get_col( $sql ) );
	}
}
