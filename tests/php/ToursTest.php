<?php
/**
 * @covers \BVM\Tours
 */

use BVM\Tours;

class ToursTest extends WP_UnitTestCase {

	public function set_up(): void {
		parent::set_up();
		// Plugin::init() ran at bootstrap; make sure the init-hooked
		// registration has executed for this test site.
		Tours::register_meta();
	}

	public function test_meta_is_registered_for_rest(): void {
		$this->assertTrue(
			registered_meta_key_exists( 'user', Tours::META_KEY )
		);

		$keys = get_registered_meta_keys( 'user' );
		$args = $keys[ Tours::META_KEY ];
		$this->assertSame( 'object', $args['type'] );
		$this->assertTrue( $args['single'] );
		$this->assertNotEmpty( $args['show_in_rest'] );
		$this->assertSame(
			[ 'type' => 'boolean' ],
			$args['show_in_rest']['schema']['additionalProperties']
		);
	}

	public function test_sanitize_keeps_only_valid_completed_flags(): void {
		$dirty = [
			'management'            => true,
			'editor-panel'          => 1,
			'falsy-dropped'         => false,
			'bad key!'              => true,
			"<script>alert(1)</script>" => true,
		];
		$this->assertSame(
			[
				'management'   => true,
				'editor-panel' => true,
			],
			Tours::sanitize( $dirty )
		);
	}

	public function test_sanitize_rejects_non_arrays_and_caps_size(): void {
		$this->assertSame( [], Tours::sanitize( 'not-an-array' ) );
		$this->assertSame( [], Tours::sanitize( null ) );

		$many = [];
		for ( $i = 0; $i < 100; $i++ ) {
			$many[ "tour-$i" ] = true;
		}
		$this->assertCount( Tours::MAX_TOURS, Tours::sanitize( $many ) );
	}

	public function test_auth_allows_only_own_meta(): void {
		$editor_a = self::factory()->user->create( [ 'role' => 'editor' ] );
		$editor_b = self::factory()->user->create( [ 'role' => 'editor' ] );

		wp_set_current_user( $editor_a );
		$this->assertTrue(
			map_meta_cap( 'edit_user_meta', $editor_a, $editor_a, Tours::META_KEY ) !== [ 'do_not_allow' ]
			&& current_user_can( 'edit_user_meta', $editor_a, Tours::META_KEY )
		);
		$this->assertFalse(
			current_user_can( 'edit_user_meta', $editor_b, Tours::META_KEY )
		);
	}

	/**
	 * The real pin on Tours::auth: an ADMINISTRATOR (who can edit_users, so
	 * core alone would let the write through) must still be unable to change
	 * another user's tour state. An editor-vs-editor check passes even with
	 * the auth_callback deleted.
	 */
	public function test_admins_cannot_write_other_users_tour_state(): void {
		$author = self::factory()->user->create( [ 'role' => 'author' ] );
		update_user_meta( $author, Tours::META_KEY, [ 'management' => true ] );

		wp_set_current_user(
			self::factory()->user->create( [ 'role' => 'administrator' ] )
		);
		$request = new WP_REST_Request( 'POST', '/wp/v2/users/' . $author );
		$request->set_body_params(
			[ 'meta' => [ Tours::META_KEY => [ 'hacked' => true ] ] ]
		);
		rest_get_server()->dispatch( $request );

		$this->assertSame(
			[ 'management' => true ],
			(array) get_user_meta( $author, Tours::META_KEY, true ),
			'Another user\'s tour state must be immutable, even for admins.'
		);
	}

	/**
	 * Cross-user READS must not expose the key either (verified behavior of
	 * core's meta handling for the users controller — pinned so a core or
	 * registration change that starts leaking it fails loudly).
	 */
	public function test_tour_state_not_exposed_to_other_users(): void {
		$author = self::factory()->user->create( [ 'role' => 'author' ] );
		update_user_meta( $author, Tours::META_KEY, [ 'management' => true ] );
		// A published post makes the user publicly visible in the REST API.
		self::factory()->post->create(
			[ 'post_author' => $author, 'post_status' => 'publish' ]
		);

		// A server carried over from an earlier test caches the users
		// controller's item schema from before this key's registration state
		// was relevant, which defeats context filtering. Production builds a
		// fresh server per request — do the same here.
		$GLOBALS['wp_rest_server'] = null;

		foreach ( [ 0, self::factory()->user->create( [ 'role' => 'editor' ] ) ] as $viewer ) {
			wp_set_current_user( $viewer );
			$request  = new WP_REST_Request( 'GET', '/wp/v2/users/' . $author );
			$data     = rest_get_server()->dispatch( $request )->get_data();
			$this->assertArrayNotHasKey(
				Tours::META_KEY,
				(array) ( $data['meta'] ?? [] ),
				'Tour state leaked to viewer ' . $viewer
			);
		}
	}

	public function test_rest_round_trip_via_users_me(): void {
		$editor = self::factory()->user->create( [ 'role' => 'editor' ] );
		wp_set_current_user( $editor );

		$request = new WP_REST_Request( 'POST', '/wp/v2/users/me' );
		$request->set_body_params(
			[
				'meta' => [
					Tours::META_KEY => [ 'management' => true ],
				],
			]
		);
		$response = rest_get_server()->dispatch( $request );
		$this->assertSame( 200, $response->get_status() );

		$read = new WP_REST_Request( 'GET', '/wp/v2/users/me' );
		$read->set_param( 'context', 'edit' );
		$data = rest_get_server()->dispatch( $read )->get_data();
		$this->assertSame(
			[ 'management' => true ],
			(array) $data['meta'][ Tours::META_KEY ]
		);
	}

	public function test_admin_assets_enqueued_on_variation_list_screen(): void {
		$editor = self::factory()->user->create( [ 'role' => 'editor' ] );
		wp_set_current_user( $editor );
		update_user_meta( $editor, Tours::META_KEY, [ 'management' => true ] );

		set_current_screen( 'edit-' . BVM_CPT );
		Tours::enqueue_admin();

		$this->assertTrue( wp_script_is( 'bvm-tours-admin', 'enqueued' ) );
		$this->assertTrue( wp_style_is( 'bvm-tours-admin', 'enqueued' ) );

		$data = wp_scripts()->get_data( 'bvm-tours-admin', 'data' );
		$this->assertStringContainsString( '"management":true', $data );

		wp_dequeue_script( 'bvm-tours-admin' );
		wp_dequeue_style( 'bvm-tours-admin' );
	}

	public function test_editor_bundle_localizes_tour_seed(): void {
		$editor = self::factory()->user->create( [ 'role' => 'editor' ] );
		wp_set_current_user( $editor );
		update_user_meta( $editor, Tours::META_KEY, [ 'editor-panel' => true ] );

		set_current_screen( 'post' );
		\BVM\Assets::enqueue_editor();

		$data = wp_scripts()->get_data( 'bvm-editor', 'data' );
		$this->assertStringContainsString( '"toursCompleted"', $data );
		$this->assertStringContainsString( '"editor-panel":true', $data );

		wp_dequeue_script( 'bvm-editor' );
	}

	public function test_admin_assets_not_enqueued_on_other_screens(): void {
		wp_set_current_user(
			self::factory()->user->create( [ 'role' => 'editor' ] )
		);
		set_current_screen( 'edit-post' );
		Tours::enqueue_admin();
		$this->assertFalse( wp_script_is( 'bvm-tours-admin', 'enqueued' ) );
	}

	public function test_rest_write_is_sanitized(): void {
		$editor = self::factory()->user->create( [ 'role' => 'editor' ] );
		wp_set_current_user( $editor );

		$request = new WP_REST_Request( 'POST', '/wp/v2/users/me' );
		$request->set_body_params(
			[
				'meta' => [
					Tours::META_KEY => [
						'management' => true,
						'bad key!'   => true,
					],
				],
			]
		);
		$response = rest_get_server()->dispatch( $request );
		$this->assertSame( 200, $response->get_status() );

		$stored = get_user_meta( $editor, Tours::META_KEY, true );
		$this->assertSame( [ 'management' => true ], (array) $stored );
	}
}
