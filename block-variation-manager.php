<?php
/**
 * Plugin Name: Block Variation Manager
 * Description: Save any block's attributes as a named variation; edits propagate to every instance, preserving manual per-instance overrides.
 * Version:     0.1.0
 * Author:      christopherhopkins
 * License:     GPL-2.0-or-later
 * Text Domain: block-variation-manager
 */

namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

define( 'BVM_FILE', __FILE__ );
define( 'BVM_DIR', plugin_dir_path( __FILE__ ) );
define( 'BVM_URL', plugin_dir_url( __FILE__ ) );
define( 'BVM_CPT', 'bvm_variation' );
define( 'BVM_META_ATTRS', '_bvm_variation_attrs' );
define( 'BVM_META_BLOCK_TYPE', '_bvm_variation_block_type' );
define( 'BVM_META_INNER_BLOCKS', '_bvm_variation_inner_blocks' );
// Serialized snapshot of the source block as last propagated — lets the cron
// job distinguish "instance still matches the template" from "instance was
// hand-edited" before overwriting anything. See Propagate.
define( 'BVM_META_PROPAGATED_SOURCE', '_bvm_propagated_source' );

require_once BVM_DIR . 'includes/class-migration.php';
require_once BVM_DIR . 'includes/class-cpt.php';
require_once BVM_DIR . 'includes/class-attributes.php';
require_once BVM_DIR . 'includes/class-render.php';
require_once BVM_DIR . 'includes/class-rest.php';
require_once BVM_DIR . 'includes/class-inserter.php';
require_once BVM_DIR . 'includes/class-assets.php';
require_once BVM_DIR . 'includes/class-block-registry.php';
require_once BVM_DIR . 'includes/class-propagate.php';
require_once BVM_DIR . 'includes/class-plugin.php';

Plugin::init();
