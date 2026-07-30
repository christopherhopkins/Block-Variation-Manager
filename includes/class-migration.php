<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

/**
 * One-shot migration from the plugin's original `ncss_*` identifiers to
 * `bvm_*`. Safe to run repeatedly — guarded by an option flag.
 *
 * What moves:
 *   - post_type           `ncss_block_variation` → `bvm_variation`
 *   - post meta keys       `_ncss_variation_*`    → `_bvm_variation_*`
 *   - block attribute keys  `ncssVariationId`      → `bvmVariationId`
 *                           `ncssOverriddenAttrs`  → `bvmOverriddenAttrs`
 *     (inside post_content JSON — runs a SQL REPLACE)
 *
 * Runs once early on `init`. On sites that never had the plugin under its
 * former name this is effectively a no-op (the UPDATEs match zero rows).
 */
class Migration {
	private const VERSION_OPTION = 'bvm_migration_version';
	private const TARGET_VERSION = '1';

	public static function init(): void {
		add_action( 'init', [ self::class, 'maybe_run' ], 5 );
	}

	public static function maybe_run(): void {
		if ( get_option( self::VERSION_OPTION ) === self::TARGET_VERSION ) {
			return;
		}
		self::run();
		// Autoloaded: this option is read on every request's init — leaving
		// it non-autoloaded costs one extra uncached query per request
		// forever on sites without a persistent object cache.
		update_option( self::VERSION_OPTION, self::TARGET_VERSION, true );
	}

	private static function run(): void {
		global $wpdb;

		$changed = 0;

		// Rename CPT posts.
		$changed += (int) $wpdb->update(
			$wpdb->posts,
			[ 'post_type' => BVM_CPT ],
			[ 'post_type' => 'ncss_block_variation' ]
		);

		// Rename meta keys. Only rows with the old prefix are touched.
		$changed += (int) $wpdb->query(
			"UPDATE {$wpdb->postmeta}
			 SET meta_key = REPLACE(meta_key, '_ncss_variation_', '_bvm_variation_')
			 WHERE meta_key LIKE '\\_ncss\\_variation\\_%'"
		);

		// Rewrite block attribute keys embedded in post_content JSON.
		// Both needles are unique enough (they're preceded by a `"` and
		// followed by a `:` in serialized block comments) that a plain
		// REPLACE won't hit unrelated content.
		$changed += (int) $wpdb->query(
			"UPDATE {$wpdb->posts}
			 SET post_content = REPLACE(post_content, 'ncssVariationId', 'bvmVariationId')
			 WHERE post_content LIKE '%ncssVariationId%'"
		);
		$changed += (int) $wpdb->query(
			"UPDATE {$wpdb->posts}
			 SET post_content = REPLACE(post_content, 'ncssOverriddenAttrs', 'bvmOverriddenAttrs')
			 WHERE post_content LIKE '%ncssOverriddenAttrs%'"
		);

		// Raw SQL bypasses the object cache: on sites with a persistent
		// cache, stale post/meta rows would keep serving the old names —
		// every variation would look empty — while the version option
		// already says the migration ran and will never retry.
		if ( $changed > 0 ) {
			wp_cache_flush();
		}
	}
}
