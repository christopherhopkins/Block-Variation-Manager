<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

class Assets {
	public static function init(): void {
		add_action( 'enqueue_block_editor_assets', [ self::class, 'enqueue_editor' ] );
		add_filter( 'block_editor_settings_all', [ self::class, 'seed_variation_template' ], 10, 2 );
	}

	/**
	 * Seed the variation editor with the correct root block.
	 *
	 * NOTE: we intentionally do not set templateLock here. A root-level
	 * templateLock cascades to inner blocks, which would block the user
	 * from building nested structures inside the variation. Root-only
	 * enforcement (exactly one block of $block_type) is done client-side
	 * in source/admin/variation-editor.js — that lets inner-block editing
	 * stay fully unrestricted, which is the whole point of allowing inner
	 * blocks in variations.
	 *
	 * @param array<string,mixed>      $settings
	 * @param \WP_Block_Editor_Context $context
	 * @return array<string,mixed>
	 */
	public static function seed_variation_template( $settings, $context ) {
		$block_type = self::variation_block_type_for_context( $context );
		if ( null === $block_type ) {
			return $settings;
		}
		if ( empty( $settings['template'] ) ) {
			$settings['template'] = [ [ $block_type ] ];
		}
		return $settings;
	}

	private static function variation_block_type_for_context( $context ): ?string {
		if ( ! $context instanceof \WP_Block_Editor_Context ) {
			return null;
		}
		$post = $context->post ?? null;
		if ( ! $post instanceof \WP_Post || BVM_CPT !== $post->post_type ) {
			return null;
		}
		$block_type = CPT::get_block_type( (int) $post->ID );
		return ( is_string( $block_type ) && '' !== $block_type ) ? $block_type : null;
	}

	public static function enqueue_editor(): void {
		$asset_file = BVM_DIR . 'build/entry.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = include $asset_file;
		if ( ! is_array( $asset ) ) {
			return;
		}

		wp_enqueue_script(
			'bvm-editor',
			BVM_URL . 'build/entry.js',
			$asset['dependencies'] ?? [],
			$asset['version'] ?? null,
			[
				'in_footer' => false,
			]
		);

		wp_set_script_translations( 'bvm-editor', 'block-variation-manager' );

		$screen               = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		$is_variation_editor  = $screen && BVM_CPT === $screen->post_type;
		$variation_block_type = '';
		$variation_usage      = 0;
		if ( $is_variation_editor && isset( $_GET['post'] ) ) {
			$post_id              = (int) $_GET['post'];
			$variation_block_type = (string) ( CPT::get_block_type( $post_id ) ?? '' );
			$variation_usage      = CPT::count_usage( $post_id );
		}

		wp_localize_script(
			'bvm-editor',
			'BVM',
			[
				'restNamespace'       => Rest::NAMESPACE,
				'cpt'                 => BVM_CPT,
				'adminUrl'            => admin_url( 'post.php' ),
				'variationListUrl'    => add_query_arg(
					[ 'post_type' => BVM_CPT ],
					admin_url( 'edit.php' )
				),
				'isVariationEditor'   => (bool) $is_variation_editor,
				'variationBlockType'  => $variation_block_type,
				'variationUsageCount' => $variation_usage,
			]
		);

		if ( file_exists( BVM_DIR . 'build/entry.css' ) ) {
			wp_enqueue_style(
				'bvm-editor',
				BVM_URL . 'build/entry.css',
				[],
				$asset['version'] ?? null
			);
		}
	}
}
