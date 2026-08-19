<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

/**
 * Server-side re-bake of instance post_content when a variation changes.
 *
 * Why this exists:
 *   Core WP blocks bake attribute-derived markup into save()'s output, which
 *   is stored verbatim in post_content. render_block_data mutates the parsed
 *   attrs at render time, but nothing rebuilds the baked HTML from those
 *   attrs — so a variation edit doesn't reach the frontend until the post is
 *   re-opened + re-saved in the editor (where save() runs in JS). This class
 *   closes that gap by walking each instance's post_content and splicing the
 *   variation's own baked wrapper markup back in. The variation post's own
 *   post_content is the golden snapshot — Gutenberg saves it via /wp/v2/
 *   after running save() in JS, so the wrapper it contains is current.
 *
 *   Only runs for block types where CPT::block_needs_bake() returns true
 *   (default: static-save blocks, i.e. no render_callback). Dynamic blocks —
 *   including Kadence's request-time CSS pipeline — pick up variation
 *   changes via the render-time merge without any baked-HTML rewrite.
 *
 *   Instance blocks with bvmOverriddenAttrs set, or whose baked HTML /
 *   children no longer match the last-propagated snapshot (hand-edited text
 *   or restructured children), are skipped — clobbering them would silently
 *   destroy user edits. Skipped items surface via an admin notice on the
 *   Variations list.
 */
class Propagate {
	const HOOK             = 'bvm_propagate_variation';
	const BATCH_SIZE       = 50;
	const SKIPPED_OPT      = 'bvm_propagate_skipped';
	const DISMISS_QUERY    = 'bvm_dismiss_propagate_notice';
	const DISMISS_NONCE    = 'bvm_dismiss_propagate';

	public static function init(): void {
		// priority 20 so sync_attrs_from_content (priority 10) has already
		// written the fresh attrs/inner_blocks meta we read here.
		add_action( 'save_post_' . BVM_CPT, [ self::class, 'schedule' ], 20, 2 );
		add_action( self::HOOK, [ self::class, 'run' ], 10, 2 );
		add_action( 'admin_notices', [ self::class, 'render_admin_notice' ] );
		add_action( 'admin_init', [ self::class, 'handle_dismiss' ] );
	}

	public static function schedule( int $post_id, \WP_Post $post ): void {
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}
		if ( 'publish' !== $post->post_status ) {
			return;
		}
		$args = [ $post_id, 0 ];
		if ( false === wp_next_scheduled( self::HOOK, $args ) ) {
			wp_schedule_single_event( time() + 60, self::HOOK, $args );
		}
	}

	public static function run( int $variation_id, int $after_id = 0 ): void {
		$variation = get_post( $variation_id );
		if ( ! $variation || BVM_CPT !== $variation->post_type || 'publish' !== $variation->post_status ) {
			return;
		}

		// Pull the canonical block_name from meta rather than guessing from
		// post_content's root. Variations of child-only blocks (kadence/singlebtn,
		// core/list-item, …) wrap their source inside a synthetic parent in
		// post_content so the editor will render them; the wrapper's blockName
		// is NOT the variation's source.
		$block_name = (string) CPT::get_block_type( $variation_id );
		if ( '' === $block_name ) {
			return;
		}
		$source = self::extract_source_block( (string) $variation->post_content, $block_name );
		if ( null === $source ) {
			return;
		}

		$needs_bake      = CPT::block_needs_bake( $block_name );
		$variation_inner = is_array( $source['innerBlocks'] ?? null ) ? $source['innerBlocks'] : [];
		$has_inner       = ! empty( $variation_inner );

		// Nothing to rewrite server-side: root attrs reach the frontend via
		// the render-time merge filter. Still refresh the snapshot so later
		// runs (if a template appears) compare against the right baseline.
		if ( ! $needs_bake && ! $has_inner ) {
			self::write_snapshot( $variation_id );
			return;
		}

		$variation_attrs = CPT::get_attrs( $variation_id );
		if ( null === $variation_attrs ) {
			// Variation was unpublished/trashed between schedule and run.
			return;
		}

		// Keyset pagination: IDs ascending with an ID cursor. OFFSET over
		// post_modified DESC reshuffled between batches (our own updates and
		// concurrent editor saves bump post_modified), silently skipping rows.
		$ids = CPT::usage_post_ids( $variation_id, $after_id, self::BATCH_SIZE );
		if ( empty( $ids ) ) {
			if ( 0 === $after_id ) {
				// No instances at all — clear any stale skipped record.
				self::write_skipped( $variation_id, [] );
			}
			self::write_snapshot( $variation_id );
			return;
		}
		$skipped = ( 0 === $after_id ) ? [] : self::read_skipped_for( $variation_id );

		$ctx = [
			'variation_id'    => $variation_id,
			'block_name'      => $block_name,
			'source'          => $source,
			'variation_attrs' => $variation_attrs,
			'variation_inner' => $variation_inner,
			'needs_bake'      => $needs_bake,
			'has_inner'       => $has_inner,
			// The source as it was LAST propagated. Instances matching it are
			// in sync (safe to overwrite with the new source); instances that
			// differ were hand-edited and are skipped + surfaced. Null on
			// legacy variations — comparisons then fall back to the current
			// source, which is conservative: a matching instance needs no
			// write anyway, a differing one is flagged instead of clobbered.
			'old_source'      => self::read_snapshot( $variation_id ),
		];

		foreach ( $ids as $inst_id ) {
			$inst_post = get_post( $inst_id );
			if ( ! $inst_post ) {
				continue;
			}

			$state = [
				'changed'          => false,
				'override_attrs'   => [],
				'inner_diverged'   => false,
				'content_diverged' => false,
			];
			$new_parsed = self::walk( parse_blocks( (string) $inst_post->post_content ), $ctx, $state );

			if ( ! empty( $state['override_attrs'] ) || $state['inner_diverged'] || $state['content_diverged'] ) {
				$permalink = get_permalink( $inst_id );
				$skipped[] = [
					'id'               => $inst_id,
					'title'            => get_the_title( $inst_id ),
					// get_edit_post_link() is cap-gated and cron has no user;
					// rows are capability-filtered at render time instead.
					'edit_link'        => admin_url( 'post.php?post=' . $inst_id . '&action=edit' ),
					'permalink'        => is_string( $permalink ) ? $permalink : '',
					'overrides'        => array_values( array_unique( $state['override_attrs'] ) ),
					'inner_diverged'   => $state['inner_diverged'],
					'content_diverged' => $state['content_diverged'],
				];
			}

			if ( $state['changed'] ) {
				self::update_instance_content( $inst_id, serialize_blocks( $new_parsed ), $inst_post );
			}
		}

		self::write_skipped( $variation_id, $skipped );

		if ( count( $ids ) >= self::BATCH_SIZE ) {
			// Dedupe like schedule(): if run() executes twice with the same
			// cursor (parallel cron runners, wp-cli alongside web cron), an
			// unguarded schedule would pile up duplicate continuation events.
			$args = [ $variation_id, $ids[ count( $ids ) - 1 ] ];
			if ( false === wp_next_scheduled( self::HOOK, $args ) ) {
				wp_schedule_single_event( time() + 30, self::HOOK, $args );
			}
		} else {
			// Final batch done: what we just propagated becomes the baseline
			// for the next run's in-sync checks.
			self::write_snapshot( $variation_id );
		}
	}

	/**
	 * Record the variation's current source block as the last-propagated
	 * snapshot (serialized block markup in meta). Written when a propagation
	 * run completes and at REST create time — NOT on every variation save,
	 * because until a run completes the instances still carry the previous
	 * template and must be compared against it.
	 */
	public static function write_snapshot( int $variation_id ): void {
		$variation = get_post( $variation_id );
		if ( ! $variation ) {
			return;
		}
		$block_name = (string) CPT::get_block_type( $variation_id );
		if ( '' === $block_name ) {
			return;
		}
		$source = self::extract_source_block( (string) $variation->post_content, $block_name );
		if ( null === $source ) {
			return;
		}
		// Meta writes expect slashed values; serialize_block() output carries
		// backslash escapes that update_post_meta would otherwise strip.
		update_post_meta( $variation_id, BVM_META_PROPAGATED_SOURCE, wp_slash( serialize_block( $source ) ) );
	}

	/** @return array<string,mixed>|null The last-propagated source block, parsed. */
	private static function read_snapshot( int $variation_id ): ?array {
		$raw = get_post_meta( $variation_id, BVM_META_PROPAGATED_SOURCE, true );
		if ( ! is_string( $raw ) || '' === trim( $raw ) ) {
			return null;
		}
		foreach ( parse_blocks( $raw ) as $b ) {
			if ( ! empty( $b['blockName'] ) ) {
				return $b;
			}
		}
		return null;
	}

	/**
	 * Persist a rewritten instance tree.
	 *
	 * wp_update_post expects slashed data (it wp_unslash()es internally).
	 * serialize_blocks() output is full of backslash escape sequences emitted
	 * by serialize_block_attributes() (", &, --, …), so
	 * writing it unslashed strips the backslashes and corrupts every escaped
	 * attribute in the post — including blocks unrelated to the variation.
	 *
	 * Runs inside WP-Cron where no user is authenticated, so kses filters are
	 * active and would strip markup (e.g. iframes/scripts in a Custom HTML
	 * block) that a capable user legally saved. Every block being written back
	 * was already filtered at its original save, so suspend kses for this
	 * write and restore the current-user state after.
	 */
	private static function update_instance_content( int $inst_id, string $content, \WP_Post $inst_post ): void {
		// Don't re-enter our own save hooks when the instance happens to be a
		// bvm_variation (e.g., a nested-variation template): schedule would
		// loop the cron job, and the meta sync would overwrite the nested
		// variation's attrs meta from its freshly spliced content.
		$is_nested_variation = ( BVM_CPT === $inst_post->post_type );
		if ( $is_nested_variation ) {
			remove_action( 'save_post_' . BVM_CPT, [ self::class, 'schedule' ], 20 );
			remove_action( 'save_post_' . BVM_CPT, [ CPT::class, 'sync_attrs_from_content' ], 10 );
		}
		kses_remove_filters();
		wp_update_post(
			wp_slash(
				[
					'ID'           => $inst_id,
					'post_content' => $content,
				]
			)
		);
		kses_init();
		if ( $is_nested_variation ) {
			add_action( 'save_post_' . BVM_CPT, [ self::class, 'schedule' ], 20, 2 );
			add_action( 'save_post_' . BVM_CPT, [ CPT::class, 'sync_attrs_from_content' ], 10, 2 );
		}
	}

	/**
	 * Find the variation's canonical source block by name, descending into
	 * any synthetic parent wrappers introduced for editor compatibility
	 * (see Rest::wrap_for_editing). For root-capable blocks, falls back to
	 * the first non-empty root block when no by-name match is found — this
	 * preserves backwards-compatibility with legacy variations whose meta
	 * block_type may have drifted from the actual root, and is safe because
	 * a root-capable block has no wrapper to confuse the search.
	 *
	 * @return array<string,mixed>|null
	 */
	private static function extract_source_block( string $content, string $block_name ): ?array {
		if ( '' === trim( $content ) || '' === $block_name ) {
			return null;
		}
		$blocks = parse_blocks( $content );
		$found  = CPT::find_block( $blocks, $block_name );
		if ( null !== $found ) {
			return $found;
		}
		// Root-capable fallback: if the variation's block_type is allowed at
		// the root (no `parent` constraint in its block.json), the first
		// non-empty root block IS the source. For child-only blocks
		// (parent_of() != null), refuse to fall back — the wrapper's root
		// is the parent, not the source, and using it would propagate
		// against the wrong block type.
		if ( null !== BlockRegistry::parent_of( $block_name ) ) {
			return null;
		}
		foreach ( $blocks as $b ) {
			if ( ! empty( $b['blockName'] ) ) {
				return $b;
			}
		}
		return null;
	}

	/**
	 * Walk the parsed tree and update variation-linked blocks. Two independent
	 * propagation paths can fire on the same matched block, and BOTH are
	 * guarded by the last-propagated snapshot: an instance is only rewritten
	 * when its current state still matches what the previous propagation (or
	 * insert) left there — anything else is a hand edit, which is skipped and
	 * surfaced via the admin notice instead of being overwritten.
	 *
	 *   - Bake-splice ($ctx[needs_bake]): merge the variation's attrs OVER
	 *     the instance's (instance-only attrs like className/anchor/fontSize
	 *     survive) and rewrite the wrapper HTML from the variation's
	 *     innerContent. The snapshot guard is what protects baked text
	 *     (heading/button content) that bvmOverriddenAttrs cannot always
	 *     represent.
	 *
	 *   - Inner-block replace ($ctx[has_inner]): swap the instance's children
	 *     for the variation's tree, but only when the children still match
	 *     the last-propagated template (names at every depth AND attrs +
	 *     innerHTML, normalized against registered defaults). A per-instance
	 *     child edit (a button label, a pane title) therefore blocks the
	 *     replace for that instance rather than being silently reverted.
	 *
	 * @param array<int,array<string,mixed>> $blocks
	 * @param array<string,mixed>            $ctx    Loop-invariant facts (see run()).
	 * @param array<string,mixed>            $state  Accumulators: changed,
	 *                                               override_attrs, inner_diverged,
	 *                                               content_diverged.
	 * @return array<int,array<string,mixed>>
	 */
	private static function walk( array $blocks, array $ctx, array &$state ): array {
		$out = [];
		foreach ( $blocks as $b ) {
			$name  = (string) ( $b['blockName'] ?? '' );
			$attrs = is_array( $b['attrs'] ?? null ) ? $b['attrs'] : [];
			$ref   = isset( $attrs['bvmVariationId'] ) ? (int) $attrs['bvmVariationId'] : 0;

			if ( $name === $ctx['block_name'] && $ref === $ctx['variation_id'] ) {
				$overrides = isset( $attrs['bvmOverriddenAttrs'] ) && is_array( $attrs['bvmOverriddenAttrs'] )
					? array_values( array_filter( $attrs['bvmOverriddenAttrs'], 'is_string' ) )
					: [];
				foreach ( $overrides as $k ) {
					$state['override_attrs'][] = $k;
				}

				$old_source = is_array( $ctx['old_source'] ?? null ) ? $ctx['old_source'] : $ctx['source'];

				// Inner-block propagation (independent of root-attr overrides:
				// overriding bgColor at root says nothing about whether
				// children should keep up with the variation's template).
				$applied_inner = false;
				if ( $ctx['has_inner'] ) {
					$inst_inner = is_array( $b['innerBlocks'] ?? null ) ? $b['innerBlocks'] : [];
					$old_inner  = is_array( $old_source['innerBlocks'] ?? null ) ? $old_source['innerBlocks'] : [];
					if ( self::trees_match( $inst_inner, $old_inner ) ) {
						if ( ! self::trees_match( $inst_inner, $ctx['variation_inner'] ) ) {
							// PHP arrays copy on assignment — no clone needed.
							$b['innerBlocks'] = $ctx['variation_inner'];
							if ( count( $ctx['variation_inner'] ) !== count( $inst_inner ) ) {
								// Keep the parent's null slots in step with
								// the new child count or serialize_blocks()
								// drops/duplicates children.
								$b['innerContent'] = self::rebuild_inner_content(
									is_array( $b['innerContent'] ?? null ) ? $b['innerContent'] : [],
									count( $ctx['variation_inner'] )
								);
							}
							$state['changed'] = true;
						}
						$applied_inner = true;
					} else {
						$state['inner_diverged'] = true;
					}
				}

				// Root bake-splice. Skipped when the instance has overrides
				// (the splice would rewrite wrapper attrs/classes the override
				// preserves) or when the wrapper HTML no longer matches the
				// last-propagated snapshot (a hand edit to baked content).
				if ( $ctx['needs_bake'] && empty( $overrides ) ) {
					list( $new_prefix, $new_suffix )   = self::wrapper_html( $ctx['source'] );
					list( $old_prefix, $old_suffix )   = self::wrapper_html( $old_source );
					list( $inst_prefix, $inst_suffix ) = self::wrapper_html( $b );

					$in_sync = trim( $inst_prefix ) === trim( $old_prefix )
						&& trim( $inst_suffix ) === trim( $old_suffix );
					if ( ! $in_sync ) {
						$state['content_diverged'] = true;
					} else {
						$merged                   = array_merge( $attrs, Attributes::strip_excluded( $ctx['variation_attrs'] ) );
						$merged['bvmVariationId'] = $ctx['variation_id'];

						$html_changed = trim( $inst_prefix ) !== trim( $new_prefix )
							|| trim( $inst_suffix ) !== trim( $new_suffix );
						if ( $merged != $attrs || $html_changed ) {
							$inst_children = is_array( $b['innerBlocks'] ?? null ) ? $b['innerBlocks'] : [];
							$new_ic        = [];
							if ( '' !== $new_prefix || empty( $inst_children ) ) {
								$new_ic[] = $new_prefix;
							}
							for ( $i = 0, $n = count( $inst_children ); $i < $n; $i++ ) {
								$new_ic[] = null;
							}
							if ( '' !== $new_suffix ) {
								$new_ic[] = $new_suffix;
							}

							$b['attrs']        = $merged;
							$b['innerContent'] = $new_ic;
							$b['innerHTML']    = $new_prefix . $new_suffix;
							$state['changed']  = true;
						}
					}
				}

				// Recurse into existing children only when we didn't replace
				// them — newly applied inner trees come from the variation
				// itself and are authoritative for this pass.
				if ( ! $applied_inner ) {
					$b['innerBlocks'] = self::walk(
						is_array( $b['innerBlocks'] ?? null ) ? $b['innerBlocks'] : [],
						$ctx,
						$state
					);
				}
				$out[] = $b;
				continue;
			}

			$b['innerBlocks'] = self::walk(
				is_array( $b['innerBlocks'] ?? null ) ? $b['innerBlocks'] : [],
				$ctx,
				$state
			);
			$out[] = $b;
		}
		return $out;
	}

	/**
	 * Deep tree equality for the in-sync checks: same count and blockName at
	 * every depth, same attrs (normalized against registered defaults so a
	 * side whose comment omitted default-equal attrs doesn't read as an
	 * edit; bookkeeping attrs ignored; == so key order is irrelevant), and
	 * same trimmed innerHTML (where core child text lives).
	 *
	 * @param array<int,array<string,mixed>> $a
	 * @param array<int,array<string,mixed>> $b
	 */
	private static function trees_match( array $a, array $b ): bool {
		if ( count( $a ) !== count( $b ) ) {
			return false;
		}
		$a = array_values( $a );
		$b = array_values( $b );
		foreach ( $a as $i => $node ) {
			$a_name = (string) ( $node['blockName'] ?? '' );
			$b_name = (string) ( $b[ $i ]['blockName'] ?? '' );
			if ( '' === $a_name || $a_name !== $b_name ) {
				return false;
			}
			$a_attrs = Attributes::strip_excluded(
				CPT::merge_with_defaults( $a_name, is_array( $node['attrs'] ?? null ) ? $node['attrs'] : [] )
			);
			$b_attrs = Attributes::strip_excluded(
				CPT::merge_with_defaults( $b_name, is_array( $b[ $i ]['attrs'] ?? null ) ? $b[ $i ]['attrs'] : [] )
			);
			if ( $a_attrs != $b_attrs ) {
				return false;
			}
			if ( trim( (string) ( $node['innerHTML'] ?? '' ) ) !== trim( (string) ( $b[ $i ]['innerHTML'] ?? '' ) ) ) {
				return false;
			}
			$a_inner = is_array( $node['innerBlocks'] ?? null ) ? $node['innerBlocks'] : [];
			$b_inner = is_array( $b[ $i ]['innerBlocks'] ?? null ) ? $b[ $i ]['innerBlocks'] : [];
			if ( ! self::trees_match( $a_inner, $b_inner ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * A block's wrapper HTML halves: the leading and trailing string segments
	 * of innerContent. Childless blocks put their whole markup in a single
	 * leading segment (suffix '').
	 *
	 * @param array<string,mixed> $block
	 * @return array{0:string,1:string}
	 */
	private static function wrapper_html( array $block ): array {
		$ic = is_array( $block['innerContent'] ?? null ) ? array_values( $block['innerContent'] ) : [];
		$n  = count( $ic );
		$prefix = ( $n > 0 && is_string( $ic[0] ) ) ? $ic[0] : '';
		$suffix = ( $n > 1 && is_string( $ic[ $n - 1 ] ) ) ? $ic[ $n - 1 ] : '';
		return [ $prefix, $suffix ];
	}

	/**
	 * Rebuild an innerContent array for a new child count, preserving the
	 * existing leading/trailing wrapper segments. Interior whitespace
	 * separators are dropped — cosmetic only.
	 *
	 * @param array<int,string|null> $ic
	 * @return array<int,string|null>
	 */
	private static function rebuild_inner_content( array $ic, int $null_count ): array {
		list( $prefix, $suffix ) = self::wrapper_html( [ 'innerContent' => $ic ] );
		$out = [];
		if ( '' !== $prefix || 0 === $null_count ) {
			$out[] = $prefix;
		}
		for ( $i = 0; $i < $null_count; $i++ ) {
			$out[] = null;
		}
		if ( '' !== $suffix ) {
			$out[] = $suffix;
		}
		return $out;
	}

	/**
	 * @return array<int,array<int,array{id:int,title:string,edit_link:string}>>
	 */
	private static function read_all_skipped(): array {
		$raw = get_option( self::SKIPPED_OPT, [] );
		return is_array( $raw ) ? $raw : [];
	}

	/**
	 * @return array<int,array{id:int,title:string,edit_link:string}>
	 */
	private static function read_skipped_for( int $variation_id ): array {
		$all = self::read_all_skipped();
		$val = $all[ $variation_id ] ?? [];
		return is_array( $val ) ? $val : [];
	}

	/**
	 * @param array<int,array{id:int,title:string,edit_link:string}> $rows
	 */
	private static function write_skipped( int $variation_id, array $rows ): void {
		$all = self::read_all_skipped();
		if ( empty( $rows ) ) {
			unset( $all[ $variation_id ] );
		} else {
			$all[ $variation_id ] = array_values( $rows );
		}
		if ( empty( $all ) ) {
			delete_option( self::SKIPPED_OPT );
		} else {
			update_option( self::SKIPPED_OPT, $all, false );
		}
	}

	/**
	 * Shows on two admin screens:
	 *  - Tools → Block Variations (list): aggregated across every variation,
	 *    grouped by variation so each post is tied back to the variation
	 *    that it's out of sync with.
	 *  - A single variation's edit screen: scoped to that variation only, so
	 *    the author sees skipped posts immediately after saving.
	 *
	 * Each row links to the affected post's editor and lists the attribute
	 * names that blocked auto-update — so the author knows what to reconcile
	 * (or intentionally keep overridden) before re-saving.
	 */
	public static function render_admin_notice(): void {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen ) {
			return;
		}

		$scope_id = 0;
		$is_list  = ( 'edit-' . BVM_CPT === $screen->id );
		$is_edit  = ( BVM_CPT === $screen->id && 'post' === $screen->base );
		if ( $is_edit ) {
			$scope_id = isset( $_GET['post'] ) ? (int) $_GET['post'] : 0;
			if ( $scope_id <= 0 ) {
				return;
			}
		} elseif ( ! $is_list ) {
			return;
		}

		$all = self::read_all_skipped();
		if ( $scope_id > 0 ) {
			$all = isset( $all[ $scope_id ] ) && ! empty( $all[ $scope_id ] )
				? [ $scope_id => $all[ $scope_id ] ]
				: [];
		}
		// The option is written by cron with no user context and may reference
		// posts this viewer cannot edit — only surface rows they can act on.
		foreach ( $all as $vid => $rows ) {
			$all[ $vid ] = array_values(
				array_filter(
					(array) $rows,
					static function ( $row ) {
						return isset( $row['id'] ) && current_user_can( 'edit_post', (int) $row['id'] );
					}
				)
			);
		}
		if ( empty( $all ) ) {
			return;
		}

		$total = 0;
		foreach ( $all as $rows ) {
			$total += count( $rows );
		}
		if ( 0 === $total ) {
			return;
		}

		$dismiss_args = [ self::DISMISS_QUERY => '1' ];
		if ( $scope_id > 0 ) {
			$dismiss_args['bvm_dismiss_variation'] = $scope_id;
		}
		$dismiss_url = wp_nonce_url(
			add_query_arg( $dismiss_args ),
			self::DISMISS_NONCE
		);

		echo '<div class="notice notice-warning">';
		echo '<p><strong>' . esc_html__( 'Block Variation Manager', 'block-variation-manager' ) . '</strong> — ';
		echo esc_html(
			sprintf(
				/* translators: %d: number of skipped posts */
				_n(
					'%d post was not auto-updated after a variation change because it has per-instance overrides, or its content or inner blocks have been edited away from the variation.',
					'%d posts were not auto-updated after a variation change because they have per-instance overrides, or their content or inner blocks have been edited away from the variation.',
					$total,
					'block-variation-manager'
				),
				$total
			)
		);
		echo ' ' . esc_html__( 'Open each post and save to pick up the latest variation values, clear the override on the affected attribute(s) first, or restore the original content/child structure to accept the new version.', 'block-variation-manager' );
		echo '</p>';

		foreach ( $all as $variation_id => $rows ) {
			if ( empty( $rows ) ) {
				continue;
			}
			if ( ! $is_edit ) {
				// On the list screen, name each variation so the user knows
				// which source their post is out of sync with.
				$v_title = get_the_title( (int) $variation_id );
				if ( '' === $v_title ) {
					$v_title = sprintf( '#%d', (int) $variation_id );
				}
				printf(
					'<p style="margin:0.75em 0 0.25em;"><strong>%s</strong></p>',
					esc_html(
						sprintf(
							/* translators: %s: variation title */
							__( 'Variation: %s', 'block-variation-manager' ),
							$v_title
						)
					)
				);
			}
			echo '<ul style="margin:0 0 0.5em 1.5em;list-style:disc;">';
			foreach ( $rows as $row ) {
				$title = ( isset( $row['title'] ) && '' !== $row['title'] )
					? $row['title']
					: sprintf( '#%d', (int) $row['id'] );
				$overrides = isset( $row['overrides'] ) && is_array( $row['overrides'] )
					? $row['overrides']
					: [];
				$permalink = isset( $row['permalink'] ) ? (string) $row['permalink'] : '';
				$edit_link = isset( $row['edit_link'] ) ? (string) $row['edit_link'] : '';

				// Title → live page. Authors asked for direct page access;
				// the separate (edit) link keeps the fix path one click away.
				if ( '' !== $permalink ) {
					$title_html = sprintf(
						'<a href="%s">%s</a>',
						esc_url( $permalink ),
						esc_html( $title )
					);
				} elseif ( '' !== $edit_link ) {
					// No permalink (e.g., draft with no preview): fall back
					// to the edit screen so the link still leads somewhere.
					$title_html = sprintf(
						'<a href="%s">%s</a>',
						esc_url( $edit_link ),
						esc_html( $title )
					);
				} else {
					$title_html = esc_html( $title );
				}

				$edit_html = '';
				if ( '' !== $edit_link && '' !== $permalink ) {
					$edit_html = sprintf(
						' <a href="%s" style="font-size:0.9em;">(%s)</a>',
						esc_url( $edit_link ),
						esc_html__( 'edit', 'block-variation-manager' )
					);
				}

				$override_html = '';
				if ( ! empty( $overrides ) ) {
					$override_html = ' — ' . sprintf(
						/* translators: %s: comma-separated list of attribute names */
						esc_html__( 'overrides: %s', 'block-variation-manager' ),
						esc_html( implode( ', ', $overrides ) )
					);
				}

				$inner_html = '';
				if ( ! empty( $row['inner_diverged'] ) ) {
					// Separator between override list and divergence note when both apply.
					$prefix     = ( '' === $override_html ) ? ' — ' : '; ';
					$inner_html = $prefix . esc_html__( 'inner block structure diverged', 'block-variation-manager' );
				}

				$content_html = '';
				if ( ! empty( $row['content_diverged'] ) ) {
					$prefix       = ( '' === $override_html && '' === $inner_html ) ? ' — ' : '; ';
					$content_html = $prefix . esc_html__( 'block content was edited directly (e.g. text)', 'block-variation-manager' );
				}

				printf(
					'<li>%s%s%s%s%s</li>',
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- title/edit/overrides/inner built from escaped parts above.
					$title_html,
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					$edit_html,
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					$override_html,
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					$inner_html,
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					$content_html
				);
			}
			echo '</ul>';
		}

		printf(
			'<p><a class="button button-secondary" href="%s">%s</a></p>',
			esc_url( $dismiss_url ),
			esc_html__( 'Dismiss', 'block-variation-manager' )
		);
		echo '</div>';
	}

	public static function handle_dismiss(): void {
		if ( ! isset( $_GET[ self::DISMISS_QUERY ] ) ) {
			return;
		}
		if ( ! current_user_can( 'edit_posts' ) ) {
			return;
		}
		check_admin_referer( self::DISMISS_NONCE );

		$scope_id = isset( $_GET['bvm_dismiss_variation'] ) ? (int) $_GET['bvm_dismiss_variation'] : 0;
		if ( $scope_id > 0 ) {
			$all = self::read_all_skipped();
			unset( $all[ $scope_id ] );
			if ( empty( $all ) ) {
				delete_option( self::SKIPPED_OPT );
			} else {
				update_option( self::SKIPPED_OPT, $all, false );
			}
		} else {
			delete_option( self::SKIPPED_OPT );
		}

		wp_safe_redirect(
			remove_query_arg( [ self::DISMISS_QUERY, 'bvm_dismiss_variation', '_wpnonce' ] )
		);
		exit;
	}
}
