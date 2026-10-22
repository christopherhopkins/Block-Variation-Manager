<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

/**
 * One-shot migrations, each guarded by the `bvm_migration_version` option
 * (numeric compare — safe to run repeatedly).
 *
 * v1 — rename the plugin's original `ncss_*` identifiers to `bvm_*`:
 *   - post_type           `ncss_block_variation` → `bvm_variation`
 *   - post meta keys       `_ncss_variation_*`    → `_bvm_variation_*`
 *   - block attribute keys  `ncssVariationId`      → `bvmVariationId`
 *                           `ncssOverriddenAttrs`  → `bvmOverriddenAttrs`
 *     (inside post_content JSON — runs a SQL REPLACE)
 *   Runs early on `init` (priority 5). On sites that never had the plugin
 *   under its former name this is effectively a no-op.
 *
 * v2 — reset stale propagation snapshots after the §9.18 bake
 *   reclassification (see maybe_run_v2). Runs late on `init` (priority 999)
 *   because it needs the block registry populated.
 */
class Migration {
	private const VERSION_OPTION = 'bvm_migration_version';
	private const TARGET_VERSION = '2';

	public static function init(): void {
		add_action( 'init', [ self::class, 'maybe_run' ], 5 );
		// v2 must classify block types, so it runs AFTER block registration
		// (core and vendors register on init ~10).
		add_action( 'init', [ self::class, 'maybe_run_v2' ], 999 );
	}

	public static function maybe_run(): void {
		if ( (int) get_option( self::VERSION_OPTION ) >= 1 ) {
			return;
		}
		// SEC-8: the first requests after activation race here (any visitor,
		// no lock) — without this, concurrent hits each repeat the bulk
		// UPDATEs and the global cache flush.
		if ( ! self::acquire_lock() ) {
			return;
		}
		self::run();
		// Autoloaded: this option is read on every request's init — leaving
		// it non-autoloaded costs one extra uncached query per request
		// forever on sites without a persistent object cache.
		update_option( self::VERSION_OPTION, '1', true );
		self::release_lock();
	}

	/**
	 * v2: reset propagation snapshots for block types whose bake
	 * classification flipped when block_needs_bake() stopped trusting
	 * is_dynamic() (§9.18). While those blocks were misclassified, every
	 * variation save advanced `_bvm_propagated_source` via the attrs-only
	 * early exit WITHOUT rewriting any instance, so the snapshot no longer
	 * describes what instances actually carry — the in-sync guard would flag
	 * every one of them diverged forever. Deleting the snapshot falls back to
	 * the documented conservative first run (compare against the CURRENT
	 * source: matching instances converge as no-ops, differing ones are
	 * flagged for a manual re-save, nothing is clobbered).
	 *
	 * Scoped to flipped types only — is_dynamic() true AND needs_bake true —
	 * so valid snapshots on genuinely static blocks keep their precision.
	 */
	public static function maybe_run_v2(): void {
		if ( (int) get_option( self::VERSION_OPTION ) >= 2 ) {
			return;
		}
		if ( ! self::acquire_lock() ) {
			return;
		}

		$ids = get_posts(
			[
				'post_type'      => BVM_CPT,
				'post_status'    => 'any',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'no_found_rows'  => true,
			]
		);
		$registry = class_exists( '\\WP_Block_Type_Registry' )
			? \WP_Block_Type_Registry::get_instance()
			: null;

		foreach ( $ids as $id ) {
			$block_type = CPT::get_block_type( (int) $id );
			if ( null === $block_type || null === $registry ) {
				continue;
			}
			$type = $registry->get_registered( $block_type );
			if ( $type && $type->is_dynamic() && CPT::block_needs_bake( $block_type ) ) {
				delete_post_meta( (int) $id, BVM_META_PROPAGATED_SOURCE );
			}
		}

		update_option( self::VERSION_OPTION, self::TARGET_VERSION, true );
		self::release_lock();
	}

	/**
	 * One short-lived lock shared by both migrations (SEC-8). add_option is
	 * atomic (INSERT fails if the row exists), unlike set_transient's
	 * update-or-insert; the lock self-expires via the timestamp check so a
	 * fatal mid-migration cannot wedge the site for more than a minute.
	 */
	private static function acquire_lock(): bool {
		$now = time();
		if ( add_option( 'bvm_migration_lock', (string) $now, '', false ) ) {
			return true;
		}
		$held = (int) get_option( 'bvm_migration_lock' );
		if ( $held && $now - $held < 60 ) {
			return false;
		}
		update_option( 'bvm_migration_lock', (string) $now, false );
		return true;
	}

	private static function release_lock(): void {
		delete_option( 'bvm_migration_lock' );
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
