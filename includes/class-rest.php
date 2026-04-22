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
		$post_content   = is_string( $client_content ) && '' !== trim( $client_content )
			? $client_content
			: self::serialize_single_block( $block_type, $preset_attrs );
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
				$update['post_content'] = self::serialize_single_block( $effective_block_type, $attrs );
			}
		}
		if ( count( $update ) > 1 ) {
			wp_update_post( $update );
		}

		return self::serialize( get_post( $id ) );
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
