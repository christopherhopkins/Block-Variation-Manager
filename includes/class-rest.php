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
					'permission_callback' => [ self::class, 'can_create' ],
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
					'permission_callback' => [ self::class, 'can_edit_item' ],
					'args'                => self::write_args(),
				],
				[
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => [ self::class, 'delete_variation' ],
					'permission_callback' => [ self::class, 'can_delete_item' ],
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
			// Update-only: when true and no 'content' is supplied, splice the
			// attrs into the EXISTING parsed post_content (preserving children
			// and baked HTML). Default false: an attrs update touches meta
			// only — used by the editor's post-save attrs sync, where the
			// content was just saved by the editor itself.
			'sync_content' => [
				'type'     => 'boolean',
				'required' => false,
				'default'  => false,
			],
		];
	}

	public static function can_read(): bool {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Creating a variation publishes it immediately (and it starts affecting
	 * live pages via the render merge), so require publish rights — a bare
	 * `edit_posts` check would let Contributors publish content sitewide.
	 */
	public static function can_create(): bool {
		return current_user_can( 'edit_posts' ) && current_user_can( 'publish_posts' );
	}

	/**
	 * Per-object capability check. A global `edit_posts` gate would let any
	 * Contributor rewrite or force-delete other users' variations; map_meta_cap
	 * gives the correct author/editor semantics per post.
	 *
	 * @return true|\WP_Error
	 */
	private static function item_check( \WP_REST_Request $request, string $cap ) {
		$id   = (int) $request['id'];
		$post = get_post( $id );
		if ( ! $post || BVM_CPT !== $post->post_type ) {
			return new \WP_Error( 'bvm_not_found', __( 'Variation not found.', 'block-variation-manager' ), [ 'status' => 404 ] );
		}
		if ( ! current_user_can( $cap, $id ) ) {
			return new \WP_Error(
				'bvm_forbidden',
				__( 'Sorry, you are not allowed to manage this variation.', 'block-variation-manager' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}
		return true;
	}

	/** @return true|\WP_Error */
	public static function can_edit_item( \WP_REST_Request $request ) {
		return self::item_check( $request, 'edit_post' );
	}

	/** @return true|\WP_Error */
	public static function can_delete_item( \WP_REST_Request $request ) {
		return self::item_check( $request, 'delete_post' );
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
		// list_usage spans drafts/private posts across all users; only
		// surface rows this user could actually open — otherwise any
		// edit_posts user could enumerate other authors' unpublished titles.
		$rows = array_values(
			array_filter(
				CPT::list_usage( $id ),
				static function ( $row ) {
					return current_user_can( 'edit_post', (int) $row['id'] );
				}
			)
		);
		return [ 'id' => $id, 'instances' => $rows ];
	}

	public static function get_variation( \WP_REST_Request $request ) {
		$id   = (int) $request['id'];
		$post = get_post( $id );
		// Non-published variations 404 for consistency with the render merge
		// and the list route (both publish-only). Returning them with empty
		// attrs made clients treat a draft as "loaded" and silently disable
		// override tracking for its instances.
		if ( ! $post || BVM_CPT !== $post->post_type || 'publish' !== $post->post_status ) {
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

		$preset_attrs = is_array( $attrs ) ? Attributes::strip_excluded( $attrs ) : [];
		$client_content = $request->get_param( 'content' );
		$inner_content  = is_string( $client_content ) && '' !== trim( $client_content )
			? $client_content
			: self::serialize_single_block( $block_type, $preset_attrs );
		$post_content   = self::wrap_for_editing( $block_type, $inner_content );
		// Suppress the save_post meta sync during insert: no block_type meta
		// exists yet, so the sync's fallback would mistake the synthetic
		// wrapper for the source block and persist its child (the real
		// source) as a bogus self-referential inner-block template. The
		// authoritative meta is written directly below instead.
		remove_action( 'save_post_' . BVM_CPT, [ CPT::class, 'sync_attrs_from_content' ], 10 );
		// wp_insert_post expects slashed data; REST params and the client's
		// serialize() output arrive unslashed and contain "-style escape
		// sequences that an unslashed insert would corrupt.
		$post_id = wp_insert_post(
			wp_slash(
				[
					'post_type'    => BVM_CPT,
					'post_status'  => 'publish',
					'post_title'   => is_string( $title ) && '' !== $title ? $title : __( 'Untitled Variation', 'block-variation-manager' ),
					'post_content' => $post_content,
				]
			),
			true
		);
		add_action( 'save_post_' . BVM_CPT, [ CPT::class, 'sync_attrs_from_content' ], 10, 2 );
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		update_post_meta( $post_id, BVM_META_BLOCK_TYPE, $block_type );
		// wp_slash: update_post_meta unslashes its value, which would strip
		// wp_json_encode's backslash escapes and corrupt the stored JSON.
		update_post_meta( $post_id, BVM_META_ATTRS, wp_slash( wp_json_encode( $preset_attrs ) ) );

		$inner_blocks = $request->get_param( 'inner_blocks' );
		if ( is_array( $inner_blocks ) ) {
			update_post_meta( $post_id, BVM_META_INNER_BLOCKS, wp_slash( wp_json_encode( self::sanitize_inner_tree( $inner_blocks ) ) ) );
		}

		// Seed the propagation snapshot so the first cron run can tell
		// "instance still matches the template" from "instance was edited".
		Propagate::write_snapshot( $post_id );

		return self::serialize( get_post( $post_id ) );
	}

	public static function update_variation( \WP_REST_Request $request ) {
		$id   = (int) $request['id'];
		$post = get_post( $id );
		if ( ! $post || BVM_CPT !== $post->post_type ) {
			return new \WP_Error( 'bvm_not_found', __( 'Variation not found.', 'block-variation-manager' ), [ 'status' => 404 ] );
		}

		$title        = $request->get_param( 'title' );
		$block_type   = $request->get_param( 'block_type' );
		$attrs        = $request->get_param( 'attrs' );
		$content      = $request->get_param( 'content' );
		$inner_blocks = $request->get_param( 'inner_blocks' );
		$sync_content = (bool) $request->get_param( 'sync_content' );

		if ( is_string( $block_type ) && '' !== $block_type ) {
			update_post_meta( $id, BVM_META_BLOCK_TYPE, $block_type );
		}
		$effective_block_type = (string) CPT::get_block_type( $id );

		$update = [ 'ID' => $id ];
		if ( is_string( $title ) && '' !== $title ) {
			$update['post_title'] = $title;
		}

		// Content precedence: an explicit client-serialized 'content' wins —
		// it alone can carry static save() markup. Otherwise, when asked to
		// sync_content, splice the attrs into the EXISTING parsed source
		// block so inner blocks and baked HTML survive. (The old behavior —
		// regenerating a bare childless block from attrs — destroyed the
		// variation's children and static markup on every attrs update.)
		if ( is_string( $content ) && '' !== trim( $content ) && '' !== $effective_block_type ) {
			$update['post_content'] = self::wrap_for_editing( $effective_block_type, $content );
		} elseif ( $sync_content && is_array( $attrs ) && '' !== $effective_block_type ) {
			$spliced = self::splice_attrs_into_content( $post, $effective_block_type, $attrs );
			if ( null !== $spliced ) {
				$update['post_content'] = $spliced;
			}
		}

		// The post update runs FIRST so the save_post sync's content-derived
		// meta is then overlaid by the authoritative values below.
		if ( count( $update ) > 1 ) {
			// Slashed for the same reason as create_variation above.
			wp_update_post( wp_slash( $update ) );
		}

		if ( is_array( $attrs ) ) {
			// wp_slash: see create_variation.
			update_post_meta( $id, BVM_META_ATTRS, wp_slash( wp_json_encode( Attributes::strip_excluded( $attrs ) ) ) );
		}
		if ( is_array( $inner_blocks ) ) {
			update_post_meta( $id, BVM_META_INNER_BLOCKS, wp_slash( wp_json_encode( self::sanitize_inner_tree( $inner_blocks ) ) ) );
		}

		// A meta-only update never fires save_post, so make sure the
		// propagation job still runs; schedule() dedupes via wp_next_scheduled.
		if ( is_array( $attrs ) || is_array( $inner_blocks ) ) {
			$post_after = get_post( $id );
			if ( $post_after ) {
				Propagate::schedule( $id, $post_after );
			}
		}

		return self::serialize( get_post( $id ) );
	}

	/**
	 * Replace the source block's comment attrs inside the variation's
	 * existing post_content, leaving children and innerHTML untouched.
	 * Returns null when the content has no matching source block.
	 */
	private static function splice_attrs_into_content( \WP_Post $post, string $block_type, array $attrs ): ?string {
		$existing = (string) $post->post_content;
		if ( '' === trim( $existing ) ) {
			return null;
		}
		$blocks = parse_blocks( $existing );
		$done   = false;
		$blocks = self::replace_block_attrs( $blocks, $block_type, $attrs, $done );
		return $done ? serialize_blocks( $blocks ) : null;
	}

	/**
	 * Depth-first: rewrite the attrs of the first block named $block_type.
	 *
	 * @param array<int,array<string,mixed>> $blocks
	 * @return array<int,array<string,mixed>>
	 */
	private static function replace_block_attrs( array $blocks, string $block_type, array $attrs, bool &$done ): array {
		foreach ( $blocks as $i => $b ) {
			if ( $done ) {
				break;
			}
			if ( ! empty( $b['blockName'] ) && $b['blockName'] === $block_type ) {
				$blocks[ $i ]['attrs'] = $attrs;
				$done                  = true;
				break;
			}
			if ( isset( $b['innerBlocks'] ) && is_array( $b['innerBlocks'] ) && ! empty( $b['innerBlocks'] ) ) {
				$blocks[ $i ]['innerBlocks'] = self::replace_block_attrs( $b['innerBlocks'], $block_type, $attrs, $done );
			}
		}
		return $blocks;
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
				Attributes::strip_excluded( $attrs ),
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
		$chain = BlockRegistry::wrapper_chain( $block_type );
		array_pop( $chain ); // The block itself — already serialized in $content.
		$body = $content;
		foreach ( array_reverse( $chain ) as $parent ) {
			$body = '<!-- wp:' . $parent . ' -->' . "\n" . $body . "\n" . '<!-- /wp:' . $parent . ' -->';
		}
		return $body;
	}

	/**
	 * Serialize a single block comment with the given attributes. Used as the
	 * variation's post_content so the block editor can load it on the edit screen.
	 *
	 * Uses core's comment-delimited serializer: serialize_block_attributes()
	 * escapes `--`, `<`, `>`, `&`, and `"` so attribute values can never
	 * terminate the HTML comment or be mangled by kses — a hand-rolled
	 * wp_json_encode() comment cannot make that guarantee.
	 *
	 * @param array<string,mixed> $attrs
	 */
	private static function serialize_single_block( string $block_name, array $attrs ): string {
		return get_comment_delimited_block_content( $block_name, $attrs, '' );
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
