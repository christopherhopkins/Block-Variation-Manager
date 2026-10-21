<?php
/**
 * Inner-template propagation: trees_match guards, template replacement,
 * linked-child preservation, scheduling guards, and the admin notice.
 *
 * @covers \BVM\Propagate
 */

use BVM\Propagate;

class PropagateInnerBlocksTest extends WP_UnitTestCase {

	private function group_block( array $children_html, array $attrs = [] ): string {
		$json = empty( $attrs ) ? '' : ' ' . wp_json_encode( $attrs );
		return '<!-- wp:group' . $json . ' --><div class="wp-block-group">'
			. implode( '', $children_html )
			. '</div><!-- /wp:group -->';
	}

	private function paragraph( string $text, array $attrs = [] ): string {
		$json = empty( $attrs ) ? '' : ' ' . wp_json_encode( $attrs );
		return '<!-- wp:paragraph' . $json . ' --><p>' . $text . '</p><!-- /wp:paragraph -->';
	}

	private function create_group_variation( array $children_html ): int {
		$vid = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_content' => $this->group_block( $children_html ),
			]
		);
		update_post_meta( $vid, BVM_META_BLOCK_TYPE, 'core/group' );
		BVM\CPT::sync_attrs_from_content( $vid, get_post( $vid ) );
		Propagate::write_snapshot( $vid );
		return $vid;
	}

	private function create_group_instance( int $vid, array $children_html ): int {
		return self::factory()->post->create(
			[
				'post_type'    => 'post',
				'post_status'  => 'publish',
				'post_content' => $this->group_block( $children_html, [ 'bvmVariationId' => $vid ] ),
			]
		);
	}

	public function test_matching_children_are_replaced_by_the_new_template(): void {
		$vid      = $this->create_group_variation( [ $this->paragraph( 'One' ) ] );
		$instance = $this->create_group_instance( $vid, [ $this->paragraph( 'One' ) ] );

		wp_update_post(
			[
				'ID'           => $vid,
				'post_content' => $this->group_block(
					[ $this->paragraph( 'One v2' ), $this->paragraph( 'Two' ) ]
				),
			]
		);
		Propagate::run( $vid );

		$content = get_post( $instance )->post_content;
		$this->assertStringContainsString( 'One v2', $content );
		$this->assertStringContainsString( 'Two', $content );
		$this->assertStringNotContainsString( '<p>One</p>', $content );
	}

	public function test_hand_edited_children_block_the_replace_and_surface(): void {
		$vid      = $this->create_group_variation( [ $this->paragraph( 'One' ) ] );
		$instance = $this->create_group_instance( $vid, [ $this->paragraph( 'My own text' ) ] );

		wp_update_post(
			[
				'ID'           => $vid,
				'post_content' => $this->group_block( [ $this->paragraph( 'One v2' ) ] ),
			]
		);
		Propagate::run( $vid );

		$content = get_post( $instance )->post_content;
		$this->assertStringContainsString( 'My own text', $content );
		$this->assertStringNotContainsString( 'One v2', $content );

		$skipped = get_option( Propagate::SKIPPED_OPT, [] );
		$this->assertTrue( (bool) $skipped[ $vid ][0]['inner_diverged'] );
	}

	public function test_linked_children_in_the_template_are_preserved_from_the_instance(): void {
		// §9.16: the template position is a linked child; the instance's own
		// node (which may have evolved with ITS variation) must win.
		$linked_tpl  = $this->paragraph( 'captured copy', [ 'bvmVariationId' => 777 ] );
		$vid         = $this->create_group_variation( [ $linked_tpl, $this->paragraph( 'static' ) ] );
		$linked_live = $this->paragraph( 'live evolved copy', [ 'bvmVariationId' => 777, 'dropCap' => true ] );
		$instance    = $this->create_group_instance( $vid, [ $linked_live, $this->paragraph( 'static' ) ] );

		wp_update_post(
			[
				'ID'           => $vid,
				'post_content' => $this->group_block(
					[ $linked_tpl, $this->paragraph( 'static v2' ) ]
				),
			]
		);
		Propagate::run( $vid );

		$content = get_post( $instance )->post_content;
		$this->assertStringContainsString( 'static v2', $content );
		// The linked child kept the INSTANCE node, not the stale capture.
		$this->assertStringContainsString( 'live evolved copy', $content );
		$this->assertStringContainsString( '"dropCap":true', $content );
		$this->assertStringNotContainsString( 'captured copy', $content );
	}

	public function test_differently_linked_children_count_as_divergence(): void {
		$vid      = $this->create_group_variation(
			[ $this->paragraph( 'x', [ 'bvmVariationId' => 777 ] ) ]
		);
		$instance = $this->create_group_instance(
			$vid,
			[ $this->paragraph( 'x', [ 'bvmVariationId' => 888 ] ) ]
		);

		wp_update_post(
			[
				'ID'           => $vid,
				'post_content' => $this->group_block(
					[ $this->paragraph( 'y', [ 'bvmVariationId' => 777 ] ) ]
				),
			]
		);
		Propagate::run( $vid );

		$skipped = get_option( Propagate::SKIPPED_OPT, [] );
		$this->assertSame( $instance, $skipped[ $vid ][0]['id'] );
		$this->assertTrue( (bool) $skipped[ $vid ][0]['inner_diverged'] );
	}

	public function test_schedule_guards(): void {
		$vid = self::factory()->post->create(
			[ 'post_type' => BVM_CPT, 'post_status' => 'publish' ]
		);
		wp_clear_scheduled_hook( Propagate::HOOK, [ $vid, 0 ] );

		// Non-publish: no scheduling.
		$draft = self::factory()->post->create(
			[ 'post_type' => BVM_CPT, 'post_status' => 'draft' ]
		);
		Propagate::schedule( $draft, get_post( $draft ) );
		$this->assertFalse( wp_next_scheduled( Propagate::HOOK, [ $draft, 0 ] ) );

		// Publish: scheduled once, deduped on the second call.
		Propagate::schedule( $vid, get_post( $vid ) );
		$first = wp_next_scheduled( Propagate::HOOK, [ $vid, 0 ] );
		$this->assertNotFalse( $first );
		Propagate::schedule( $vid, get_post( $vid ) );
		$this->assertSame( $first, wp_next_scheduled( Propagate::HOOK, [ $vid, 0 ] ) );
	}

	public function test_admin_notice_renders_skipped_rows_for_capable_users(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		$vid      = $this->create_group_variation( [ $this->paragraph( 'One' ) ] );
		$instance = self::factory()->post->create( [ 'post_title' => 'Affected page' ] );
		update_option(
			Propagate::SKIPPED_OPT,
			[
				$vid => [
					[
						'id'               => $instance,
						'title'            => 'Affected page',
						'edit_link'        => admin_url( 'post.php?post=' . $instance . '&action=edit' ),
						'permalink'        => get_permalink( $instance ),
						'overrides'        => [ 'level' ],
						'inner_diverged'   => true,
						'content_diverged' => false,
					],
				],
			],
			false
		);

		set_current_screen( 'edit-' . BVM_CPT );
		ob_start();
		Propagate::render_admin_notice();
		$html = ob_get_clean();

		$this->assertStringContainsString( 'Affected page', $html );
		$this->assertStringContainsString( 'overrides: level', $html );
		$this->assertStringContainsString( 'inner block structure diverged', $html );
		$this->assertStringContainsString( 'Dismiss', $html );

		// Unrelated screens render nothing.
		set_current_screen( 'edit-post' );
		ob_start();
		Propagate::render_admin_notice();
		$this->assertSame( '', ob_get_clean() );
	}

	public function test_admin_notice_hides_rows_the_viewer_cannot_edit(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'contributor' ] ) );
		$vid   = $this->create_group_variation( [ $this->paragraph( 'One' ) ] );
		$other = self::factory()->post->create(); // owned by admin/no one the contributor can edit
		update_option(
			Propagate::SKIPPED_OPT,
			[
				$vid => [
					[
						'id'        => $other,
						'title'     => 'Hidden page',
						'edit_link' => '',
						'permalink' => '',
						'overrides' => [],
					],
				],
			],
			false
		);

		set_current_screen( 'edit-' . BVM_CPT );
		ob_start();
		Propagate::render_admin_notice();
		$this->assertSame( '', ob_get_clean() );
	}
}
