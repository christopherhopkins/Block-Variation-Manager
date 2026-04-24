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
	 * Two save paths exist:
	 *
	 *   1. REST (Rest::create_variation / update_variation) — supplies the
	 *      full attribute set including default-equal values, then writes
	 *      meta directly and tags BVM_META_ATTRS_SOURCE = 'rest'. We must
	 *      NOT overwrite that meta here, because parse_blocks() loses any
	 *      attr that happens to equal a block.json default. Dropping those
	 *      breaks "apply" for preset-driven blocks (kadence/infobox etc.):
	 *      preset-set attrs that match defaults silently disappear from the
	 *      variation, so applying it to an existing block can't reset them.
	 *
	 *   2. Block editor on the variation post itself — no REST tag. We
	 *      reconstruct attrs by parsing post_content and merging block-type
	 *      defaults back in to undo the same parse_blocks lossiness.
	 *
	 * Also auto-populates block_type meta if the user inserted a block but
	 * the meta hadn't been set yet.
	 */
	public static function sync_attrs_from_content( int $post_id, \WP_Post $post ): void {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}

		// REST already wrote meta with the full attr set. The 'rest' tag is
		// single-use — clear it so a subsequent block-editor edit on the
		// variation post falls back to the parse-and-merge path.
		$source = get_post_meta( $post_id, BVM_META_ATTRS_SOURCE, true );
		if ( 'rest' === $source ) {
			delete_post_meta( $post_id, BVM_META_ATTRS_SOURCE );
			return;
		}

		$content = (string) $post->post_content;
		if ( '' === trim( $content ) ) {
			update_post_meta( $post_id, BVM_META_ATTRS, wp_json_encode( [] ) );
			update_post_meta( $post_id, BVM_META_INNER_BLOCKS, wp_json_encode( [] ) );
			return;
		}
		$blocks = parse_blocks( $content );
		$first  = null;
		foreach ( $blocks as $b ) {
			if ( ! empty( $b['blockName'] ) ) {
				$first = $b;
				break;
			}
		}
		if ( null === $first ) {
			return;
		}
		$parsed_attrs = is_array( $first['attrs'] ?? null ) ? $first['attrs'] : [];
		$attrs        = self::merge_with_defaults( (string) $first['blockName'], $parsed_attrs );
		update_post_meta( $post_id, BVM_META_ATTRS, wp_json_encode( $attrs ) );

		$inner = self::shape_inner_tree( is_array( $first['innerBlocks'] ?? null ) ? $first['innerBlocks'] : [] );
		update_post_meta( $post_id, BVM_META_INNER_BLOCKS, wp_json_encode( $inner ) );

		$existing_block_type = get_post_meta( $post_id, BVM_META_BLOCK_TYPE, true );
		if ( ! $existing_block_type ) {
			update_post_meta( $post_id, BVM_META_BLOCK_TYPE, $first['blockName'] );
		}
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
	 * Recursively normalize a parse_blocks() inner-blocks tree into the
	 * { name, attributes, innerBlocks } shape stored in meta.
	 *
	 * @param array<int,array<string,mixed>> $blocks
	 * @return array<int,array{name:string,attributes:array<string,mixed>,innerBlocks:array<int,mixed>}>
	 */
	public static function shape_inner_tree( array $blocks ): array {
		$out = [];
		foreach ( $blocks as $b ) {
			if ( empty( $b['blockName'] ) ) {
				continue;
			}
			$name  = (string) $b['blockName'];
			$attrs = is_array( $b['attrs'] ?? null ) ? $b['attrs'] : [];
			$out[] = [
				'name'        => $name,
				'attributes'  => self::merge_with_defaults( $name, $attrs ),
				'innerBlocks' => self::shape_inner_tree( is_array( $b['innerBlocks'] ?? null ) ? $b['innerBlocks'] : [] ),
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

	/**
	 * Fetch the saved inner-block tree for a variation post.
	 *
	 * @return array<int,array{name:string,attributes:array<string,mixed>,innerBlocks:array<int,mixed>}>
	 */
	public static function get_inner_blocks( int $variation_id ): array {
		$post = get_post( $variation_id );
		if ( ! $post || BVM_CPT !== $post->post_type || 'publish' !== $post->post_status ) {
			return [];
		}
		$raw = get_post_meta( $variation_id, BVM_META_INNER_BLOCKS, true );
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
	 * List posts whose content references a given variation id.
	 *
	 * Admin-only — runs a LIKE against post_content. Capped at 200 rows.
	 *
	 * @return array<int,array{id:int,title:string,post_type:string,edit_link:?string,status:string}>
	 */
	public static function list_usage( int $variation_id ): array {
		global $wpdb;
		if ( $variation_id <= 0 ) {
			return [];
		}
		$needle = '"bvmVariationId":' . $variation_id;
		$like   = '%' . $wpdb->esc_like( $needle ) . '%';
		$sql    = $wpdb->prepare(
			"SELECT ID, post_title, post_type, post_status FROM {$wpdb->posts}
			 WHERE post_status IN ('publish','draft','pending','future','private')
			 AND post_type NOT IN ('revision', %s)
			 AND post_content LIKE %s
			 ORDER BY post_modified DESC
			 LIMIT 200",
			BVM_CPT,
			$like
		);
		$rows = $wpdb->get_results( $sql );
		$out  = [];
		foreach ( $rows as $row ) {
			$id      = (int) $row->ID;
			$title   = '' !== $row->post_title ? $row->post_title : __( '(no title)', 'block-variation-manager' );
			$out[]   = [
				'id'        => $id,
				'title'     => $title,
				'post_type' => $row->post_type,
				'status'    => $row->post_status,
				'edit_link' => get_edit_post_link( $id, 'raw' ),
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
		$needle = '"bvmVariationId":' . $variation_id;
		$like   = '%' . $wpdb->esc_like( $needle ) . '%';
		$sql    = $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->posts}
			 WHERE post_status IN ('publish','draft','pending','future','private')
			 AND post_type NOT IN ('revision', %s)
			 AND post_content LIKE %s",
			BVM_CPT,
			$like
		);
		return (int) $wpdb->get_var( $sql );
	}
}
