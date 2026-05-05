<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

/**
 * REST API for variation management.
 *
 * The CPT is already show_in_rest, but editors need a block-type-filtered
 * list and a simple create/update endpoint that accepts an attrs object.
 */
class Rest {
	public const NAMESPACE = 'bvm/v1';

	public static function init(): void {
		add_action( 'rest_api_init', [ self::class, 'register_routes' ] );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/variations',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ self::class, 'list_variations' ],
					'permission_callback' => [ self::class, 'can_read' ],
					'args'                => [
						'block_type' => [
							'type'              => 'string',
							'required'          => false,
							'sanitize_callback' => 'sanitize_text_field',
						],
					],
				],
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ self::class, 'create_variation' ],
					'permission_callback' => [ self::class, 'can_write' ],
					'args'                => self::write_args(),
				],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/variations/(?P<id>\d+)/usage',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ self::class, 'get_usage' ],
				'permission_callback' => [ self::class, 'can_read' ],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/variations/(?P<id>\d+)/instances',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ self::class, 'get_instances' ],
				'permission_callback' => [ self::class, 'can_read' ],
			]
		);

		register_rest_route(
			self::NAMESPACE,
			'/variations/(?P<id>\d+)',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ self::class, 'get_variation' ],
					'permission_callback' => [ self::class, 'can_read' ],
				],
				[
					'methods'             => \WP_REST_Server::EDITABLE,
					'callback'            => [ self::class, 'update_variation' ],
					'permission_callback' => [ self::class, 'can_write' ],
					'args'                => self::write_args(),
				],
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [ self::class, 'delete_variation' ],
					'permission_callback' => [ self::class, 'can_write' ],
				],
			]
		);
	}

	/** @return array<string,array<string,mixed>> */
	private static function write_args(): array {
		return [
			'title'      => [
				'type'              => 'string',
				'required'          => false,
				'sanitize_callback' => 'sanitize_text_field',
			],
			'block_type' => [
				'type'              => 'string',
				'required'          => false,
				'sanitize_callback' => 'sanitize_text_field',
			],
			'attrs'      => [
				'type'     => 'object',
				'required' => false,
			],
			// Pre-serialized block comment (from @wordpress/blocks.serialize).
			// Preferred over server-side serialization for blocks with static
			// save() functions, whose stored HTML cannot be reconstructed
			// from attrs alone.
			'content'    => [
				'type'     => 'string',
				'required' => false,
			],
			// Recursive inner block tree captured on the editor side.
			// Shape: [ { name, attributes, innerBlocks }, ... ].
			// Required for parent/child Kadence blocks (advancedbtn+singlebtn,
			// accordion+pane, tabs+tab, etc.) where children carry their own
			// meaningful attrs.
			'inner_blocks' => [
				'type'     => 'array',
				'required' => false,
			],
		];
	}

	public static function can_read(): bool {
		return current_user_can( 'edit_posts' );
	}

	public static function can_write(): bool {
		return current_user_can( 'edit_posts' );
	}

	public static function list_variations( \WP_REST_Request $request ) {
		$block_type = $request->get_param( 'block_type' );
		$query_args = [
			'post_type'      => BVM_CPT,
			'post_status'    => 'publish',
			'posts_per_page' => 200,
			'orderby'        => 'title',
			'order'          => 'ASC',
		];
		if ( is_string( $block_type ) && '' !== $block_type ) {
			$query_args['meta_query'] = [
				[
					'key'   => BVM_META_BLOCK_TYPE,
					'value' => $block_type,
				],
			];
		}
		$posts = get_posts( $query_args );
		return array_map( [ self::class, 'serialize' ], $posts );
	}

	public static function get_usage( \WP_REST_Request $request ) {
		$id = (int) $request['id'];
		return [ 'id' => $id, 'count' => CPT::count_usage( $id ) ];
	}

	public static function get_instances( \WP_REST_Request $request ) {
		$id = (int) $request['id'];
		return [ 'id' => $id, 'instances' => CPT::list_usage( $id ) ];
	}

	public static function get_variation( \WP_REST_Request $request ) {
		$id   = (int) $request['id'];
		$post = get_post( $id );
		if ( ! $post || BVM_CPT !== $post->post_type ) {
			return new \WP_Error( 'bvm_not_found', __( 'Variation not found.', 'block-variation-manager' ), [ 'status' => 404 ] );
		}
		return self::serialize( $post );
	}

	public static function create_variation( \WP_REST_Request $request ) {
		$title      = $request->get_param( 'title' );
		$block_type = $request->get_param( 'block_type' );
		$attrs      = $request->get_param( 'attrs' );

		if ( ! is_string( $block_type ) || '' === $block_type ) {
			return new \WP_Error( 'bvm_bad_request', __( 'block_type is required.', 'block-variation-manager' ), [ 'status' => 400 ] );
		}

		$preset_attrs = is_array( $attrs ) ? $attrs : [];
		$client_content = $request->get_param( 'content' );
		$inner_content  = is_string( $client_content ) && '' !== trim( $client_content )
			? $client_content
			: self::serialize_single_block( $block_type, $preset_attrs );
		$post_content   = self::wrap_for_editing( $block_type, $inner_content );
		$post_id        = wp_insert_post(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_title'   => is_string( $title ) && '' !== $title ? $title : __( 'Untitled Variation', 'block-variation-manager' ),
				'post_content' => $post_content,
			],
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		update_post_meta( $post_id, BVM_META_BLOCK_TYPE, $block_type );
		update_post_meta( $post_id, BVM_META_ATTRS, wp_json_encode( $preset_attrs ) );

		$inner_blocks = $request->get_param( 'inner_blocks' );
		if ( is_array( $inner_blocks ) ) {
			update_post_meta( $post_id, BVM_META_INNER_BLOCKS, wp_json_encode( self::sanitize_inner_tree( $inner_blocks ) ) );
		}

		// Tag this save as REST-sourced so the save_post handler doesn't
		// re-parse post_content and overwrite our full attr set with the
		// lossy default-stripped version. See CPT::sync_attrs_from_content.
		update_post_meta( $post_id, BVM_META_ATTRS_SOURCE, 'rest' );

		return self::serialize( get_post( $post_id ) );
	}

	public static function update_variation( \WP_REST_Request $request ) {
		$id   = (int) $request['id'];
		$post = get_post( $id );
		if ( ! $post || BVM_CPT !== $post->post_type ) {
			return new \WP_Error( 'bvm_not_found', __( 'Variation not found.', 'block-variation-manager' ), [ 'status' => 404 ] );
		}

		$title      = $request->get_param( 'title' );
		$block_type = $request->get_param( 'block_type' );
		$attrs      = $request->get_param( 'attrs' );

		$update = [ 'ID' => $id ];
		if ( is_string( $title ) && '' !== $title ) {
			$update['post_title'] = $title;
		}
		if ( is_string( $block_type ) && '' !== $block_type ) {
			update_post_meta( $id, BVM_META_BLOCK_TYPE, $block_type );
		}
		if ( is_array( $attrs ) ) {
			update_post_meta( $id, BVM_META_ATTRS, wp_json_encode( $attrs ) );
			$effective_block_type = is_string( $block_type ) && '' !== $block_type
				? $block_type
				: (string) CPT::get_block_type( $id );
			if ( '' !== $effective_block_type ) {
				$update['post_content'] = self::wrap_for_editing(
					$effective_block_type,
					self::serialize_single_block( $effective_block_type, $attrs )
				);
			}
		}

		$inner_blocks = $request->get_param( 'inner_blocks' );
		if ( is_array( $inner_blocks ) ) {
			update_post_meta( $id, BVM_META_INNER_BLOCKS, wp_json_encode( self::sanitize_inner_tree( $inner_blocks ) ) );
		}

		if ( is_array( $attrs ) || is_array( $inner_blocks ) ) {
			update_post_meta( $id, BVM_META_ATTRS_SOURCE, 'rest' );
		}

		if ( count( $update ) > 1 ) {
			wp_update_post( $update );
		}

		return self::serialize( get_post( $id ) );
	}

	/**
	 * Coerce an arbitrary client-supplied tree into the
	 * [ name, attrs, innerBlocks ] tuple shape we store. Accepts either the
	 * WordPress-native { name, attributes, innerBlocks } object shape (what
	 * the editor sends via `getBlocks(clientId)`) or pre-shaped tuples.
	 * Drops anything without a non-empty name.
	 *
	 * @param array<int,mixed> $tree
	 * @return array<int,array{0:string,1:array<string,mixed>,2:array<int,mixed>}>
	 */
	private static function sanitize_inner_tree( array $tree ): array {
		$out = [];
		foreach ( $tree as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			// Tuple shape: [ name, attrs, innerBlocks ].
			if ( isset( $node[0] ) && is_string( $node[0] ) ) {
				$name     = $node[0];
				$attrs    = isset( $node[1] ) && is_array( $node[1] ) ? $node[1] : [];
				$children = isset( $node[2] ) && is_array( $node[2] ) ? $node[2] : [];
			} else {
				$name     = isset( $node['name'] ) && is_string( $node['name'] ) ? $node['name'] : '';
				$attrs    = isset( $node['attributes'] ) && is_array( $node['attributes'] ) ? $node['attributes'] : [];
				$children = isset( $node['innerBlocks'] ) && is_array( $node['innerBlocks'] ) ? $node['innerBlocks'] : [];
			}
			if ( '' === $name ) {
				continue;
			}
			$out[] = [
				$name,
				$attrs,
				self::sanitize_inner_tree( $children ),
			];
		}
		return $out;
	}

	public static function delete_variation( \WP_REST_Request $request ) {
		$id   = (int) $request['id'];
		$post = get_post( $id );
		if ( ! $post || BVM_CPT !== $post->post_type ) {
			return new \WP_Error( 'bvm_not_found', __( 'Variation not found.', 'block-variation-manager' ), [ 'status' => 404 ] );
		}
		wp_delete_post( $id, true );
		return [ 'deleted' => true, 'id' => $id ];
	}

	/**
	 * Wrap serialized block content in synthetic parent block(s) when the
	 * variation's source block has a `parent` constraint. The variation's
	 * post_content needs to satisfy Gutenberg's parent rules so the block
	 * editor will render it without "block not allowed here" errors. The
	 * server's meta-extraction (`CPT::find_block`, `Propagate::extract_source_block`)
	 * sees through the wrapper to the real source block.
	 *
	 * Recursive: if the parent itself is child-only (e.g. core/list-item's
	 * parent core/list is root-capable, but in deeper hierarchies a parent
	 * could also be constrained), keep wrapping until we hit a root-capable
	 * ancestor, with a depth cap to guard against pathological cycles.
	 */
	private static function wrap_for_editing( string $block_type, string $content ): string {
		$visited = [];
		$current = $block_type;
		$body    = $content;
		// Depth cap is generous — real-world hierarchies are 1-2 deep
		// (kadence/singlebtn → kadence/advancedbtn; core/list-item → core/list).
		for ( $depth = 0; $depth < 8; $depth++ ) {
			$parent = BlockRegistry::parent_of( $current );
			if ( null === $parent || isset( $visited[ $parent ] ) ) {
				return $body;
			}
			$visited[ $parent ] = true;
			$body    = '<!-- wp:' . $parent . ' -->' . "\n" . $body . "\n" . '<!-- /wp:' . $parent . ' -->';
			$current = $parent;
		}
		return $body;
	}

	/**
	 * Serialize a single block comment with the given attributes. Used as the
	 * variation's post_content so the block editor can load it on the edit screen.
	 *
	 * @param array<string,mixed> $attrs
	 */
	private static function serialize_single_block( string $block_name, array $attrs ): string {
		$json = ! empty( $attrs ) ? wp_json_encode( $attrs ) : '';
		$open = '<!-- wp:' . $block_name . ( $json ? ' ' . $json : '' ) . ' -->';
		$close = '<!-- /wp:' . $block_name . ' -->';
		return $open . "\n" . $close;
	}

	/** @return array<string,mixed> */
	private static function serialize( \WP_Post $post ): array {
		return [
			'id'           => $post->ID,
			'title'        => $post->post_title,
			'block_type'   => CPT::get_block_type( $post->ID ),
			'attrs'        => CPT::get_attrs( $post->ID ) ?? [],
			// Saved [ name, attrs, innerBlocks ] tuples. Clients use this to
			// offer "replace inner blocks with the variation's template" on
			// apply. Empty when the variation has no nested structure.
			'inner_blocks' => CPT::get_inner_blocks( $post->ID ),
			'edit_link'    => get_edit_post_link( $post->ID, 'raw' ),
		];
	}
}
