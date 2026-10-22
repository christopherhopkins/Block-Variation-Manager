<?php
/**
 * Review-track regressions: SEC-1/3/4/5/6/8/9/10, COR-7/8/15, COR-D1/D3,
 * and the QUA-1 hostile-content slash round-trips (§9.1).
 *
 * @covers \BVM\Rest
 * @covers \BVM\Rest_Controller
 * @covers \BVM\Attributes
 * @covers \BVM\Propagate
 * @covers \BVM\Migration
 */

use BVM\Attributes;
use BVM\CPT;
use BVM\Propagate;

class SecurityHardeningTest extends WP_UnitTestCase {

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

	private function create_variation_via_rest( array $overrides = [] ): array {
		$response = $this->request(
			'POST',
			'/bvm/v1/variations',
			array_merge(
				[
					'title'      => 'Hardening fixture',
					'block_type' => 'core/heading',
					'attrs'      => [ 'level' => 3 ],
					'content'    => '<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">Fixture</h3><!-- /wp:heading -->',
				],
				$overrides
			)
		);
		$this->assertSame( 200, $response->get_status() );
		return $response->get_data();
	}

	// ─── SEC-3: core /wp/v2 route must not serve anonymous reads ───────────

	public function test_core_route_rejects_anonymous_reads(): void {
		$this->as_role( 'editor' );
		$data = $this->create_variation_via_rest();

		wp_set_current_user( 0 );
		$this->assertSame(
			401,
			$this->request( 'GET', '/wp/v2/block-variation-manager' )->get_status()
		);
		$this->assertSame(
			401,
			$this->request( 'GET', '/wp/v2/block-variation-manager/' . $data['id'] )->get_status()
		);

		// Subscribers (no edit_posts) are equally barred.
		$this->as_role( 'subscriber' );
		$this->assertSame(
			403,
			$this->request( 'GET', '/wp/v2/block-variation-manager/' . $data['id'] )->get_status()
		);

		// Editors still read normally (the block editor depends on it).
		$this->as_role( 'editor' );
		$this->assertSame(
			200,
			$this->request( 'GET', '/wp/v2/block-variation-manager/' . $data['id'] )->get_status()
		);
	}

	// ─── SEC-1/SEC-4: attr values obey the writer's content rules ──────────

	public function test_author_attr_markup_is_kses_filtered(): void {
		$this->as_role( 'author' ); // publish_posts, no unfiltered_html
		$data = $this->create_variation_via_rest(
			[
				'attrs' => [
					'level'   => 2,
					'content' => 'Hi <script>alert(1)</script><em>there</em>',
				],
			]
		);
		$this->assertSame( 'Hi alert(1)<em>there</em>', $data['attrs']['content'] );

		// The same rule holds on update.
		$updated = $this->request(
			'PUT',
			'/bvm/v1/variations/' . $data['id'],
			[ 'attrs' => [ 'content' => '<iframe src="https://evil.example"></iframe>ok' ] ]
		)->get_data();
		$this->assertSame( 'ok', $updated['attrs']['content'] );
	}

	public function test_core_route_cannot_write_meta_and_sanitize_guards_direct_writes(): void {
		$this->as_role( 'author' );
		$data = $this->create_variation_via_rest();

		// SEC-4 as reported is REFUTED: core only exposes a `meta` field for
		// post types supporting 'custom-fields', which this CPT deliberately
		// does not — a core-route PUT with meta is silently a no-op. Pin that.
		$response = $this->request(
			'PUT',
			'/wp/v2/block-variation-manager/' . $data['id'],
			[ 'meta' => [ BVM_META_ATTRS => wp_json_encode( [ 'content' => '<script>x()</script>safe' ] ) ] ]
		);
		$this->assertSame( 200, $response->get_status() );
		$this->assertArrayNotHasKey( 'meta', $response->get_data() );
		$this->assertArrayNotHasKey( 'content', CPT::get_attrs( $data['id'] ) );

		// Defense in depth: the registered sanitize_callback still guards any
		// direct programmatic write for a user without unfiltered_html.
		update_post_meta(
			$data['id'],
			BVM_META_ATTRS,
			wp_slash( wp_json_encode( [ 'content' => '<script>x()</script>safe' ] ) )
		);
		$this->assertSame( 'x()safe', CPT::get_attrs( $data['id'] )['content'] );
	}

	public function test_oversized_payloads_are_rejected(): void {
		$this->as_role( 'editor' );
		$response = $this->request(
			'POST',
			'/bvm/v1/variations',
			[
				'block_type' => 'core/heading',
				'attrs'      => [ 'blob' => str_repeat( 'a', Attributes::MAX_JSON_BYTES + 1 ) ],
			]
		);
		$this->assertSame( 400, $response->get_status() );

		// And the meta sanitize callback collapses an oversized core-route write.
		$this->assertSame(
			'',
			Attributes::sanitize_json_meta( wp_json_encode( [ 'blob' => str_repeat( 'a', Attributes::MAX_JSON_BYTES + 1 ) ] ) )
		);
	}

	// ─── SEC-9: block_type shape validation ─────────────────────────────────

	public function test_malformed_block_type_is_rejected(): void {
		$this->as_role( 'editor' );
		foreach ( [ 'no-namespace', 'x --> y', 'UPPER/case', 'core/', '/heading' ] as $bad ) {
			$response = $this->request(
				'POST',
				'/bvm/v1/variations',
				[ 'block_type' => $bad, 'attrs' => [] ]
			);
			$this->assertSame( 400, $response->get_status(), "block_type '$bad' must be rejected" );
		}
	}

	// ─── SEC-5: usage surfaces are per-object gated ─────────────────────────

	public function test_usage_routes_require_edit_rights_on_the_variation(): void {
		$this->as_role( 'editor' );
		$data = $this->create_variation_via_rest();

		// An author who cannot edit the editor's variation gets 403.
		$this->as_role( 'author' );
		$this->assertSame( 403, $this->request( 'GET', '/bvm/v1/variations/' . $data['id'] . '/usage' )->get_status() );
		$this->assertSame( 403, $this->request( 'GET', '/bvm/v1/variations/' . $data['id'] . '/instances' )->get_status() );

		// A non-variation id is a 404, not an enumeration oracle.
		$regular = self::factory()->post->create();
		$this->assertSame( 404, $this->request( 'GET', '/bvm/v1/variations/' . $regular . '/usage' )->get_status() );
	}

	// ─── COR-D1: capability filter must run before the row cap ──────────────

	public function test_instances_pagination_is_capability_aware(): void {
		$author = self::factory()->user->create( [ 'role' => 'author' ] );
		$editor = self::factory()->user->create( [ 'role' => 'editor' ] );
		wp_set_current_user( $editor );
		$data = $this->create_variation_via_rest();
		// Author co-owns the variation? No — grant via own variation instead:
		// give the author their own variation so the permission gate passes.
		wp_set_current_user( $author );
		$own = $this->create_variation_via_rest( [ 'title' => 'Author fixture' ] );

		// Oldest instance (lowest ID) belongs to the author…
		$mine = self::factory()->post->create(
			[
				'post_author'  => $author,
				'post_status'  => 'draft',
				'post_content' => '<!-- wp:heading {"bvmVariationId":' . $own['id'] . '} --><h2>mine</h2><!-- /wp:heading -->',
			]
		);
		// …followed by a page of posts the author cannot edit.
		for ( $i = 0; $i < 60; $i++ ) {
			self::factory()->post->create(
				[
					'post_author'  => $editor,
					'post_status'  => 'private',
					'post_content' => '<!-- wp:heading {"bvmVariationId":' . $own['id'] . '} --><h2>x</h2><!-- /wp:heading -->',
				]
			);
		}

		wp_set_current_user( $author );
		$rows = $this->request( 'GET', '/bvm/v1/variations/' . $own['id'] . '/instances' )->get_data();
		$ids  = array_column( $rows['instances'], 'id' );
		$this->assertSame( [ $mine ], $ids );
	}

	// ─── SEC-6: dismiss scope capabilities ──────────────────────────────────

	public function test_global_dismiss_requires_edit_others_posts(): void {
		update_option( Propagate::SKIPPED_OPT, [ 7 => [ [ 'id' => 1, 'title' => 'x', 'edit_link' => '', 'permalink' => '', 'overrides' => [] ] ] ], false );

		// Author: global dismiss refused (option survives).
		$author = $this->as_role( 'author' );
		$_GET[ Propagate::DISMISS_QUERY ] = '1';
		$_GET['_wpnonce']                 = wp_create_nonce( Propagate::DISMISS_NONCE );
		try {
			Propagate::handle_dismiss();
		} finally {
			unset( $_GET[ Propagate::DISMISS_QUERY ], $_GET['_wpnonce'] );
		}
		$this->assertNotEmpty( get_option( Propagate::SKIPPED_OPT ) );
	}

	// ─── SEC-8: migration lock ──────────────────────────────────────────────

	public function test_migration_lock_blocks_concurrent_runners(): void {
		delete_option( 'bvm_migration_version' );
		update_option( 'bvm_migration_lock', (string) time(), false );
		try {
			// A fresh, recent lock means another request is mid-migration.
			BVM\Migration::maybe_run();
			$this->assertFalse( get_option( 'bvm_migration_version' ) );
		} finally {
			delete_option( 'bvm_migration_lock' );
			update_option( 'bvm_migration_version', '2', true );
		}
	}

	// ─── COR-15: malformed override lists must not warn at render ───────────

	public function test_render_tolerates_malformed_override_entries(): void {
		$this->as_role( 'editor' );
		$data = $this->create_variation_via_rest( [ 'attrs' => [ 'level' => 2 ] ] );
		$out  = BVM\Render::apply_variation(
			[
				'blockName'    => 'core/heading',
				'attrs'        => [
					'bvmVariationId'     => $data['id'],
					'bvmOverriddenAttrs' => [ [ 'nested' => true ], 5.5, 'level' ],
					'level'              => 4,
				],
				'innerBlocks'  => [],
				'innerHTML'    => '',
				'innerContent' => [],
			]
		);
		// The string entry still counts as an override; junk is ignored.
		$this->assertSame( 4, $out['attrs']['level'] );
	}

	// ─── COR-8: deleting a variation cleans its queue and notices ───────────

	public function test_delete_cleans_cron_and_skipped_rows(): void {
		$this->as_role( 'editor' );
		$data = $this->create_variation_via_rest();
		wp_schedule_single_event( time() + 60, Propagate::HOOK, [ $data['id'], 0 ] );
		update_option( Propagate::SKIPPED_OPT, [ $data['id'] => [ [ 'id' => 1, 'title' => 'x', 'edit_link' => '', 'permalink' => '', 'overrides' => [] ] ] ], false );

		$this->request( 'DELETE', '/bvm/v1/variations/' . $data['id'] );

		$this->assertFalse( wp_next_scheduled( Propagate::HOOK, [ $data['id'], 0 ] ) );
		$this->assertArrayNotHasKey( $data['id'], (array) get_option( Propagate::SKIPPED_OPT, [] ) );
	}

	// ─── QUA-1 (§9.1): hostile content survives every write path ────────────

	public function test_hostile_attrs_round_trip_rest_create_and_update(): void {
		// unfiltered_html so kses cannot mask a slash bug — on multisite only
		// super admins have it.
		$admin = $this->as_role( 'administrator' );
		if ( is_multisite() ) {
			grant_super_admin( $admin );
		}
		$hostile = 'Backslash \\ quote " path C:\\temp -- & <em>em</em>';
		$data    = $this->create_variation_via_rest( [ 'attrs' => [ 'level' => 2, 'content' => $hostile ] ] );
		$this->assertSame( $hostile, $data['attrs']['content'] );
		$this->assertSame( $hostile, CPT::get_attrs( $data['id'] )['content'] );

		$hostile2 = 'Updated \\" double-escape \\\\ and unicode \u00e9';
		$updated  = $this->request(
			'PUT',
			'/bvm/v1/variations/' . $data['id'],
			[ 'attrs' => [ 'content' => $hostile2 ] ]
		)->get_data();
		$this->assertSame( $hostile2, $updated['attrs']['content'] );
		$this->assertSame( $hostile2, CPT::get_attrs( $data['id'] )['content'] );
	}

	public function test_hostile_baked_content_survives_propagation(): void {
		$admin = $this->as_role( 'administrator' );
		if ( is_multisite() ) {
			grant_super_admin( $admin );
		}
		$text    = 'Say &quot;hi&quot; -- dashes &amp; stuff';
		$content = '<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">' . $text . '</h3><!-- /wp:heading -->';
		$data    = $this->create_variation_via_rest( [ 'content' => $content, 'attrs' => [ 'level' => 3 ] ] );

		$instance = self::factory()->post->create(
			[
				'post_status'  => 'publish',
				'post_content' => wp_slash( '<!-- wp:heading {"level":3,"bvmVariationId":' . $data['id'] . '} --><h3 class="wp-block-heading">' . $text . '</h3><!-- /wp:heading -->' ),
			]
		);

		// Change the variation text (keeping hostile entities) and propagate.
		$new_text = 'Now \\"escaped\\" &amp; updated';
		$this->request(
			'PUT',
			'/bvm/v1/variations/' . $data['id'],
			[
				'content' => '<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">' . $new_text . '</h3><!-- /wp:heading -->',
				'attrs'   => [ 'level' => 3 ],
			]
		);
		Propagate::run( $data['id'] );

		$result = get_post( $instance )->post_content;
		$this->assertStringContainsString( $new_text, $result, 'Backslashes/entities must survive the cron rewrite byte-exact (§9.1).' );
	}
}
