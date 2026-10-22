<?php
/**
 * PHPUnit bootstrap: boots the WordPress test library provided by the
 * wp-env tests container (WP_TESTS_DIR=/wordpress-phpunit) and loads the
 * plugin as an mu-plugin.
 */

$bvm_root = dirname( __DIR__, 2 );

// Composer autoload (PHPUnit polyfills for the WP test library).
require_once $bvm_root . '/vendor/autoload.php';

if ( ! defined( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH' ) ) {
	define(
		'WP_TESTS_PHPUNIT_POLYFILLS_PATH',
		$bvm_root . '/vendor/yoast/phpunit-polyfills'
	);
}

$bvm_tests_dir = getenv( 'WP_TESTS_DIR' );
if ( ! $bvm_tests_dir ) {
	$bvm_tests_dir = getenv( 'WP_PHPUNIT__DIR' );
}
if ( ! $bvm_tests_dir ) {
	$bvm_tests_dir = '/wordpress-phpunit';
}

if ( ! file_exists( $bvm_tests_dir . '/includes/functions.php' ) ) {
	fwrite(
		STDERR,
		"WordPress test library not found at {$bvm_tests_dir}.\n" .
		"Run the suite inside wp-env: npm run test:php\n"
	);
	exit( 1 );
}

require_once $bvm_tests_dir . '/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function () use ( $bvm_root ) {
		require $bvm_root . '/block-variation-manager.php';
	}
);

require $bvm_tests_dir . '/includes/bootstrap.php';

// Shared test fixtures (QUA-18).
require_once __DIR__ . '/includes/VariationFixtures.php';
