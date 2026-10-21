<?php
/**
 * @covers \BVM\Assets
 * @covers \BVM\Plugin
 */

use BVM\Assets;
use BVM\CPT;
use BVM\Plugin;
use BVM\Propagate;
use BVM\Render;
use BVM\Rest;
use BVM\Inserter;
use BVM\Attributes;

class AssetsTest extends WP_UnitTestCase {

	private function editor_context( ?WP_Post $post ): WP_Block_Editor_Context {
		return new WP_Block_Editor_Context( $post ? [ 'post' => $post ] : [] );
	}

	public function test_template_seeded_for_variation_posts(): void {
		$vid = self::factory()->post->create(
			[ 'post_type' => BVM_CPT, 'post_status' => 'publish' ]
		);
		update_post_meta( $vid, BVM_META_BLOCK_TYPE, 'core/heading' );

		$settings = Assets::seed_variation_template( [], $this->editor_context( get_post( $vid ) ) );
		$this->assertSame( [ [ 'core/heading' ] ], $settings['template'] );
	}

	public function test_template_wraps_child_only_block_types(): void {
		$vid = self::factory()->post->create(
			[ 'post_type' => BVM_CPT, 'post_status' => 'publish' ]
		);
		update_post_meta( $vid, BVM_META_BLOCK_TYPE, 'core/list-item' );

		$settings = Assets::seed_variation_template( [], $this->editor_context( get_post( $vid ) ) );
		$this->assertSame(
			[ [ 'core/list', [], [ [ 'core/list-item' ] ] ] ],
			$settings['template']
		);
	}

	public function test_template_untouched_outside_variations(): void {
		$post     = get_post( self::factory()->post->create() );
		$settings = Assets::seed_variation_template( [ 'a' => 1 ], $this->editor_context( $post ) );
		$this->assertSame( [ 'a' => 1 ], $settings );
		$this->assertSame( [ 'a' => 1 ], Assets::seed_variation_template( [ 'a' => 1 ], $this->editor_context( null ) ) );
	}

	public function test_existing_template_is_respected(): void {
		$vid = self::factory()->post->create(
			[ 'post_type' => BVM_CPT, 'post_status' => 'publish' ]
		);
		update_post_meta( $vid, BVM_META_BLOCK_TYPE, 'core/heading' );
		$settings = Assets::seed_variation_template(
			[ 'template' => [ [ 'core/quote' ] ] ],
			$this->editor_context( get_post( $vid ) )
		);
		$this->assertSame( [ [ 'core/quote' ] ], $settings['template'] );
	}

	public function test_enqueue_editor_registers_script_and_localizes_context(): void {
		$vid = self::factory()->post->create(
			[ 'post_type' => BVM_CPT, 'post_status' => 'publish' ]
		);
		update_post_meta( $vid, BVM_META_BLOCK_TYPE, 'core/list-item' );

		set_current_screen( BVM_CPT );
		$_GET['post'] = (string) $vid;
		try {
			Assets::enqueue_editor();
		} finally {
			unset( $_GET['post'] );
		}

		$this->assertTrue( wp_script_is( 'bvm-editor', 'enqueued' ) );
		// wp_localize_script casts scalars to strings (true → "1"), and older
		// WP versions JSON-escape forward slashes ("bvm\/v1") while newer ones
		// don't — match both forms.
		$data = wp_scripts()->get_data( 'bvm-editor', 'data' );
		$this->assertMatchesRegularExpression( '~"restNamespace":"bvm\\\\?/v1"~', $data );
		$this->assertStringContainsString( '"isVariationEditor":"1"', $data );
		$this->assertMatchesRegularExpression( '~"variationBlockType":"core\\\\?/list-item"~', $data );
		// Outermost-first wrapper chain for the client root enforcement.
		$this->assertMatchesRegularExpression( '~"variationRootChain":\["core\\\\?/list","core\\\\?/list-item"\]~', $data );
	}

	public function test_enqueue_editor_outside_the_variation_screen(): void {
		set_current_screen( 'post' );
		Assets::enqueue_editor();
		$this->assertTrue( wp_script_is( 'bvm-editor', 'enqueued' ) );
		// wp_localize_script casts false → "" (and appends to prior data in
		// this registry, so assert on the empty-marker form).
		$data = wp_scripts()->get_data( 'bvm-editor', 'data' );
		$this->assertStringContainsString( '"isVariationEditor":""', $data );
	}

	public function test_plugin_init_wires_the_runtime_hooks(): void {
		// Plugin::init() ran at bootstrap; spot-check one hook per subsystem.
		$this->assertNotFalse( has_action( 'init', [ CPT::class, 'register' ] ) );
		$this->assertNotFalse( has_filter( 'register_block_type_args', [ Attributes::class, 'extend' ] ) );
		$this->assertNotFalse( has_filter( 'render_block_data', [ Render::class, 'apply_variation' ] ) );
		$this->assertNotFalse( has_action( 'rest_api_init', [ Rest::class, 'register_routes' ] ) );
		$this->assertNotFalse( has_filter( 'get_block_type_variations', [ Inserter::class, 'add_variations' ] ) );
		$this->assertNotFalse( has_action( 'enqueue_block_editor_assets', [ Assets::class, 'enqueue_editor' ] ) );
		$this->assertNotFalse( has_action( Propagate::HOOK, [ Propagate::class, 'run' ] ) );
		$this->assertNotFalse( has_action( 'save_post_' . BVM_CPT, [ CPT::class, 'sync_attrs_from_content' ] ) );
		$this->assertNotFalse( has_action( 'save_post_' . BVM_CPT, [ Propagate::class, 'schedule' ] ) );
	}

	public function test_variation_save_schedules_the_propagation_event(): void {
		$vid = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_content' => '<!-- wp:heading {"level":3} --><h3>x</h3><!-- /wp:heading -->',
			]
		);
		$this->assertNotFalse( wp_next_scheduled( Propagate::HOOK, [ $vid, 0 ] ) );
	}
}
