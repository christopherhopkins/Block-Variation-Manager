<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

/**
 * Controller for the CPT's core /wp/v2/block-variation-manager route.
 *
 * Core's WP_REST_Posts_Controller allows anonymous reads of any published
 * post regardless of the post type's `public` flag (SEC-3: confirmed with a
 * live unauthenticated GET). Variations are an editor-facing surface — every
 * bvm/v1 route requires edit_posts — so the core route must match. The block
 * editor saving a variation is always authenticated, so this costs nothing.
 */
class Rest_Controller extends \WP_REST_Posts_Controller {

	/** @param \WP_REST_Request $request */
	public function get_items_permissions_check( $request ) {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return new \WP_Error(
				'bvm_forbidden',
				__( 'Sorry, you are not allowed to view variations.', 'block-variation-manager' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}
		return parent::get_items_permissions_check( $request );
	}

	/** @param \WP_Post $post */
	public function check_read_permission( $post ) {
		return current_user_can( 'edit_posts' ) && parent::check_read_permission( $post );
	}
}
