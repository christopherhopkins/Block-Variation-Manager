<?php
/**
 * @covers \BVM\Rest
 */

use BVM\CPT;

class RestTest extends WP_UnitTestCase {

	/** @var WP_REST_Server */
	private $server;

	public function set_up(): void {
		parent::set_up();
		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server   = $wp_rest_server;
		do_action( 'rest_api_init', $wp_rest_server );
	}

	private function as_role( string $role ): int {
		$user_id = self::factory()->user->create( [ 'role' => $role ] );
		wp_set_current_user( $user_id );
		return $user_id;
	}

	private function request( string $method, string $route, array $params = [] ): WP_REST_Response {
		$request = new WP_REST_Request( $method, $route );
		if ( in_array( $method, [ 'POST', 'PUT' ], true ) ) {
			$request->set_header( 'Content-Type', 'application/json' );
			$request->set_body( wp_json_encode( $params ) );
		} else {
			foreach ( $params as $k => $v ) {
				$request->set_param( $k, $v );
			}
		}
		return $this->server->dispatch( $request );
	}

	private function create_via_rest( array $overrides = [] ): array {
		$response = $this->request(
			'POST',
			'/bvm/v1/variations',
			array_merge(
				[
					'title'      => 'Hero heading',
					'block_type' => 'core/heading',
					'attrs'      => [ 'level' => 3, 'uniqueID' => 'strip-me' ],
					'content'    => '<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">Hero</h3><!-- /wp:heading -->',
				],
				$overrides
			)
		);
		$this->assertSame( 200, $response->get_status() );
		return $response->get_data();
	}

	public function test_routes_require_authentication(): void {
		wp_set_current_user( 0 );
		$this->assertSame( 401, $this->request( 'GET', '/bvm/v1/variations' )->get_status() );
		$this->assertSame(
			401,
			$this->request( 'POST', '/bvm/v1/variations', [ 'block_type' => 'core/heading' ] )->get_status()
		);
	}

	public function test_contributors_can_read_but_not_create(): void {
		$this->as_role( 'contributor' );
		$this->assertSame( 200, $this->request( 'GET', '/bvm/v1/variations' )->get_status() );
		// Creating publishes sitewide — needs publish_posts.
		$this->assertSame(
			403,
			$this->request(
				'POST',
				'/bvm/v1/variations',
				[ 'block_type' => 'core/heading', 'attrs' => [] ]
			)->get_status()
		);
	}

	public function test_create_requires_block_type(): void {
		$this->as_role( 'editor' );
		$response = $this->request( 'POST', '/bvm/v1/variations', [ 'title' => 'x' ] );
		$this->assertSame( 400, $response->get_status() );
	}

	public function test_create_persists_meta_content_and_snapshot(): void {
		$this->as_role( 'editor' );
		$data = $this->create_via_rest();

		$this->assertSame( 'core/heading', $data['block_type'] );
		// Excluded attrs stripped from the stored preset.
		$this->assertSame( [ 'level' => 3 ], $data['attrs'] );

		$post = get_post( $data['id'] );
		$this->assertSame( 'publish', $post->post_status );
		$this->assertStringContainsString( 'Hero', $post->post_content );

		// Snapshot seeded at create so the first cron run has a baseline.
		$snapshot = get_post_meta( $data['id'], BVM_META_PROPAGATED_SOURCE, true );
		$this->assertStringContainsString( 'Hero', $snapshot );
	}

	public function test_create_wraps_child_only_blocks_for_editing(): void {
		$this->as_role( 'editor' );
		$data = $this->create_via_rest(
			[
				'title'      => 'List item',
				'block_type' => 'core/list-item',
				'attrs'      => [],
				'content'    => '<!-- wp:list-item --><li>item</li><!-- /wp:list-item -->',
			]
		);
		$content = get_post( $data['id'] )->post_content;
		// Synthetic core/list wrapper so the editor renders the child-only block.
		$this->assertStringContainsString( '<!-- wp:core/list -->', $content );
		$this->assertSame( 'core/list-item', $data['block_type'] );
	}

	public function test_create_sanitizes_inner_blocks_including_linked_children(): void {
		$this->as_role( 'editor' );
		$data = $this->create_via_rest(
			[
				'inner_blocks' => [
					[
						'name'       => 'core/paragraph',
						'attributes' => [ 'placeholder' => 'p', 'uniqueID' => 'strip' ],
					],
					[
						'name'       => 'core/heading',
						'attributes' => [ 'bvmVariationId' => 9, 'level' => 2 ],
					],
					[ 'attributes' => [ 'nameless' => true ] ],
				],
			]
		);
		$this->assertSame(
			[
				[ 'core/paragraph', [ 'placeholder' => 'p' ], [] ],
				// §9.16: linked child keeps exactly its link.
				[ 'core/heading', [ 'bvmVariationId' => 9 ], [] ],
			],
			$data['inner_blocks']
		);
	}

	public function test_list_filters_by_block_type_and_is_publish_only(): void {
		$this->as_role( 'editor' );
		$heading = $this->create_via_rest();
		$this->create_via_rest(
			[
				'title'      => 'Para',
				'block_type' => 'core/paragraph',
				'content'    => '<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->',
			]
		);
		wp_update_post( [ 'ID' => $heading['id'], 'post_status' => 'draft' ] );

		$rows = $this->request(
			'GET',
			'/bvm/v1/variations',
			[ 'block_type' => 'core/heading' ]
		)->get_data();
		$this->assertSame( [], $rows );

		$rows = $this->request(
			'GET',
			'/bvm/v1/variations',
			[ 'block_type' => 'core/paragraph' ]
		)->get_data();
		$this->assertCount( 1, $rows );
		$this->assertSame( 'Para', $rows[0]['title'] );
	}

	public function test_get_variation_404s_for_drafts_and_foreign_posts(): void {
		$this->as_role( 'editor' );
		$data = $this->create_via_rest();
		wp_update_post( [ 'ID' => $data['id'], 'post_status' => 'draft' ] );
		$this->assertSame( 404, $this->request( 'GET', '/bvm/v1/variations/' . $data['id'] )->get_status() );

		$regular = self::factory()->post->create();
		$this->assertSame( 404, $this->request( 'GET', '/bvm/v1/variations/' . $regular )->get_status() );
	}

	public function test_attrs_only_update_touches_meta_not_content(): void {
		$this->as_role( 'editor' );
		$data    = $this->create_via_rest();
		$before  = get_post( $data['id'] )->post_content;
		$updated = $this->request(
			'PUT',
			'/bvm/v1/variations/' . $data['id'],
			[ 'attrs' => [ 'level' => 2 ] ]
		)->get_data();

		$this->assertSame( [ 'level' => 2 ], $updated['attrs'] );
		$this->assertSame( $before, get_post( $data['id'] )->post_content );
	}

	public function test_sync_content_splices_attrs_preserving_markup(): void {
		$this->as_role( 'editor' );
		$data = $this->create_via_rest();
		$this->request(
			'PUT',
			'/bvm/v1/variations/' . $data['id'],
			[
				'attrs'        => [ 'level' => 5 ],
				'sync_content' => true,
			]
		);
		$content = get_post( $data['id'] )->post_content;
		$this->assertStringContainsString( '"level":5', $content );
		// Baked HTML untouched by the splice.
		$this->assertStringContainsString( '<h3 class="wp-block-heading">Hero</h3>', $content );
	}

	public function test_update_and_delete_are_per_object_capability_gated(): void {
		$this->as_role( 'editor' );
		$data = $this->create_via_rest();

		// An author may not edit someone else's variation (map_meta_cap).
		$this->as_role( 'author' );
		$this->assertSame(
			403,
			$this->request( 'PUT', '/bvm/v1/variations/' . $data['id'], [ 'title' => 'hijack' ] )->get_status()
		);
		$this->assertSame(
			403,
			$this->request( 'DELETE', '/bvm/v1/variations/' . $data['id'] )->get_status()
		);

		$this->as_role( 'editor' );
		$response = $this->request( 'DELETE', '/bvm/v1/variations/' . $data['id'] );
		$this->assertSame( 200, $response->get_status() );
		$this->assertNull( get_post( $data['id'] ) );
	}

	public function test_instances_route_hides_posts_the_user_cannot_edit(): void {
		$this->as_role( 'editor' );
		$data = $this->create_via_rest();

		$admin_id = self::factory()->user->create( [ 'role' => 'administrator' ] );
		$instance = self::factory()->post->create(
			[
				'post_author'  => $admin_id,
				'post_status'  => 'draft',
				'post_title'   => 'Secret draft',
				'post_content' => '<!-- wp:heading {"level":3,"bvmVariationId":' . $data['id'] . '} --><h3>x</h3><!-- /wp:heading -->',
			]
		);

		$rows = $this->request( 'GET', '/bvm/v1/variations/' . $data['id'] . '/instances' )->get_data();
		$this->assertSame( [ $instance ], array_column( $rows['instances'], 'id' ) );

		// A contributor cannot edit the admin's draft → hidden.
		$this->as_role( 'contributor' );
		$rows = $this->request( 'GET', '/bvm/v1/variations/' . $data['id'] . '/instances' )->get_data();
		$this->assertSame( [], $rows['instances'] );
	}

	public function test_usage_route_counts_instances(): void {
		$this->as_role( 'editor' );
		$data = $this->create_via_rest();
		self::factory()->post->create(
			[ 'post_content' => '<!-- wp:heading {"bvmVariationId":' . $data['id'] . '} --><h2>x</h2><!-- /wp:heading -->' ]
		);
		$usage = $this->request( 'GET', '/bvm/v1/variations/' . $data['id'] . '/usage' )->get_data();
		$this->assertSame( 1, $usage['count'] );
	}

	public function test_registry_route_serves_required_children(): void {
		$this->as_role( 'editor' );
		$response = $this->request( 'GET', '/bvm/v1/registry' );
		$this->assertSame( 200, $response->get_status() );
		$map = $response->get_data();
		// core/list-item declares core/list as parent in every modern WP.
		$this->assertArrayHasKey( 'core/list', $map );
		$this->assertContains( 'core/list-item', $map['core/list']['required_children'] );
		// Empty rows are omitted from the payload.
		$this->assertArrayNotHasKey( 'core/paragraph', $map );
	}
}
