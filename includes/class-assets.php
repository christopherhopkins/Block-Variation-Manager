<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

class Assets {
	public static function init(): void {
		add_action( 'enqueue_block_editor_assets', [ self::class, 'enqueue_editor' ] );
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
