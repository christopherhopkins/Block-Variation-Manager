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
