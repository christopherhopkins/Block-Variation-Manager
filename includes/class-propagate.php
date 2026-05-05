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
 *   (default: core/*). Libraries with request-time CSS pipelines like
 *   Kadence pick up variation changes without any baked-HTML rewrite.
 *
 *   Instance blocks with bvmOverriddenAttrs set are skipped — clobbering
 *   their baked HTML would silently drop the override's visual effect.
 *   Skipped items surface via an admin notice on the Variations list.
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

	public static function run( int $variation_id, int $offset = 0 ): void {
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

		// Nothing to do server-side: root attrs reach the frontend via the
		// render-time merge filter, and there's no baked HTML or inner-block
		// template to rewrite into instance post_content.
		if ( ! $needs_bake && ! $has_inner ) {
			return;
		}

		$variation_attrs = CPT::get_attrs( $variation_id );
		if ( null === $variation_attrs ) {
			// Variation was unpublished/trashed between schedule and run.
			return;
		}

		$instances = CPT::list_usage( $variation_id, $offset, self::BATCH_SIZE );
		if ( empty( $instances ) ) {
			if ( 0 === $offset ) {
				// No instances at all — clear any stale skipped record.
				self::write_skipped( $variation_id, [] );
			}
			return;
		}
		$skipped = ( 0 === $offset ) ? [] : self::read_skipped_for( $variation_id );

		foreach ( $instances as $row ) {
			$inst_id   = (int) $row['id'];
			$inst_post = get_post( $inst_id );
			if ( ! $inst_post ) {
				continue;
			}

			$parsed         = parse_blocks( (string) $inst_post->post_content );
			$changed        = false;
			$override_attrs = [];
			$inner_diverged = false;
			$new_parsed     = self::walk(
				$parsed,
				$variation_id,
				$block_name,
				$source,
				$variation_attrs,
				$variation_inner,
				$needs_bake,
				$has_inner,
				$changed,
				$override_attrs,
				$inner_diverged
			);

			if ( ! empty( $override_attrs ) || $inner_diverged ) {
				$skipped[] = [
					'id'             => $inst_id,
					'title'          => (string) $row['title'],
					'edit_link'      => (string) ( $row['edit_link'] ?? '' ),
					'permalink'      => isset( $row['permalink'] ) && is_string( $row['permalink'] ) ? $row['permalink'] : '',
					'overrides'      => array_values( array_unique( $override_attrs ) ),
					'inner_diverged' => $inner_diverged,
				];
			}

			if ( $changed ) {
				$new_content = serialize_blocks( $new_parsed );
				// Don't re-enter our own save hook when the instance happens
				// to be a bvm_variation (e.g., a nested-variation template).
				// $inst_post->post_type would have to equal BVM_CPT for this
				// to matter; guard cheaply.
				$is_nested_variation = ( BVM_CPT === $inst_post->post_type );
				if ( $is_nested_variation ) {
					remove_action( 'save_post_' . BVM_CPT, [ self::class, 'schedule' ], 20 );
				}
				wp_update_post( [
					'ID'           => $inst_id,
					'post_content' => $new_content,
				] );
				if ( $is_nested_variation ) {
					add_action( 'save_post_' . BVM_CPT, [ self::class, 'schedule' ], 20, 2 );
				}
			}
		}

		self::write_skipped( $variation_id, $skipped );

		if ( count( $instances ) >= self::BATCH_SIZE ) {
			wp_schedule_single_event( time() + 30, self::HOOK, [ $variation_id, $offset + self::BATCH_SIZE ] );
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
	 * propagation paths can fire on the same matched block:
	 *
	 *   - Bake-splice (when $needs_bake): rewrite the instance's wrapper HTML
	 *     using the variation's serialized innerContent prefix/suffix. Skipped
	 *     when the instance has root-attr overrides (would clobber the
	 *     visual effect of the override).
	 *
	 *   - Inner-block replace (when $has_inner): swap the instance's children
	 *     with a fresh deep copy of the variation's inner-block tree, but
	 *     only when the instance's children still structurally match the
	 *     variation (same names at every depth). When they've diverged,
	 *     leave the children alone and surface the instance via the skipped
	 *     notice — propagating into restructured children would silently
	 *     destroy the user's edits.
	 *
	 * @param array<int,array<string,mixed>> $blocks
	 * @param array<string,mixed> $source
	 * @param array<string,mixed> $variation_attrs
	 * @param array<int,array<string,mixed>> $variation_inner
	 * @return array<int,array<string,mixed>>
	 */
	private static function walk(
		array $blocks,
		int $variation_id,
		string $block_name,
		array $source,
		array $variation_attrs,
		array $variation_inner,
		bool $needs_bake,
		bool $has_inner,
		bool &$changed,
		array &$override_attrs,
		bool &$inner_diverged
	): array {
		$out = [];
		foreach ( $blocks as $b ) {
			$name  = (string) ( $b['blockName'] ?? '' );
			$attrs = is_array( $b['attrs'] ?? null ) ? $b['attrs'] : [];
			$ref   = isset( $attrs['bvmVariationId'] ) ? (int) $attrs['bvmVariationId'] : 0;

			if ( $name === $block_name && $ref === $variation_id ) {
				$overrides = isset( $attrs['bvmOverriddenAttrs'] ) && is_array( $attrs['bvmOverriddenAttrs'] )
					? array_values( array_filter( $attrs['bvmOverriddenAttrs'], 'is_string' ) )
					: [];
				if ( ! empty( $overrides ) ) {
					foreach ( $overrides as $k ) {
						$override_attrs[] = $k;
					}
				}

				// Inner-block propagation (independent of root-attr overrides:
				// overriding bgColor at root says nothing about whether
				// children should keep up with the variation's template).
				$applied_inner = false;
				if ( $has_inner ) {
					$inst_inner = is_array( $b['innerBlocks'] ?? null ) ? $b['innerBlocks'] : [];
					if ( self::structurally_matches( $inst_inner, $variation_inner ) ) {
						$b['innerBlocks'] = self::clone_parsed_tree( $variation_inner );
						$applied_inner    = true;
						$changed          = true;
					} else {
						$inner_diverged = true;
					}
				}

				// Root bake-splice. Skipped when the instance has overrides —
				// the splice would rewrite the wrapper attrs/classes the
				// override is meant to preserve.
				if ( $needs_bake && empty( $overrides ) ) {
					$source_ic = is_array( $source['innerContent'] ?? null ) ? $source['innerContent'] : [];
					$prefix    = '';
					$suffix    = '';
					foreach ( $source_ic as $segment ) {
						if ( is_string( $segment ) ) {
							$prefix = $segment;
							break;
						}
					}
					for ( $i = count( $source_ic ) - 1; $i >= 0; $i-- ) {
						if ( is_string( $source_ic[ $i ] ) ) {
							$suffix = (string) $source_ic[ $i ];
							break;
						}
					}
					// Single-string innerContent → prefix only, no suffix.
					if ( count( $source_ic ) <= 1 ) {
						$suffix = '';
					}

					$inst_inner = is_array( $b['innerBlocks'] ?? null ) ? $b['innerBlocks'] : [];
					$new_ic     = [];
					if ( '' !== $prefix || empty( $inst_inner ) ) {
						$new_ic[] = $prefix;
					}
					for ( $i = 0, $n = count( $inst_inner ); $i < $n; $i++ ) {
						$new_ic[] = null;
					}
					if ( '' !== $suffix ) {
						$new_ic[] = $suffix;
					}

					$new_attrs                   = $variation_attrs;
					$new_attrs['bvmVariationId'] = $variation_id;
					$b['attrs']                  = $new_attrs;
					$b['innerContent']           = $new_ic;
					$b['innerHTML']              = $prefix . $suffix;
					$changed                     = true;
				}

				// Recurse into existing children only when we didn't replace
				// them — newly applied inner trees come from the variation
				// itself and are authoritative for this pass.
				if ( ! $applied_inner ) {
					$b['innerBlocks'] = self::walk(
						$b['innerBlocks'] ?? [],
						$variation_id,
						$block_name,
						$source,
						$variation_attrs,
						$variation_inner,
						$needs_bake,
						$has_inner,
						$changed,
						$override_attrs,
						$inner_diverged
					);
				}
				$out[] = $b;
				continue;
			}

			$b['innerBlocks'] = self::walk(
				$b['innerBlocks'] ?? [],
				$variation_id,
				$block_name,
				$source,
				$variation_attrs,
				$variation_inner,
				$needs_bake,
				$has_inner,
				$changed,
				$override_attrs,
				$inner_diverged
			);
			$out[] = $b;
		}
		return $out;
	}

	/**
	 * Same length, same blockName at every depth. Per-block attrs and
	 * innerHTML are intentionally not compared — only structure decides
	 * whether it's safe to replace the children.
	 *
	 * @param array<int,array<string,mixed>> $a
	 * @param array<int,array<string,mixed>> $b
	 */
	private static function structurally_matches( array $a, array $b ): bool {
		if ( count( $a ) !== count( $b ) ) {
			return false;
		}
		foreach ( $a as $i => $node ) {
			$a_name = (string) ( $node['blockName'] ?? '' );
			$b_name = (string) ( $b[ $i ]['blockName'] ?? '' );
			if ( '' === $a_name || $a_name !== $b_name ) {
				return false;
			}
			$a_inner = is_array( $node['innerBlocks'] ?? null ) ? $node['innerBlocks'] : [];
			$b_inner = is_array( $b[ $i ]['innerBlocks'] ?? null ) ? $b[ $i ]['innerBlocks'] : [];
			if ( ! self::structurally_matches( $a_inner, $b_inner ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Deep-copy a parse_blocks() tree so the caller can splice it into
	 * another tree without aliasing.
	 *
	 * @param array<int,array<string,mixed>> $blocks
	 * @return array<int,array<string,mixed>>
	 */
	private static function clone_parsed_tree( array $blocks ): array {
		$out = [];
		foreach ( $blocks as $b ) {
			$copy                = $b;
			$copy['innerBlocks'] = isset( $b['innerBlocks'] ) && is_array( $b['innerBlocks'] )
				? self::clone_parsed_tree( $b['innerBlocks'] )
				: [];
			$out[] = $copy;
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
					'%d post was not auto-updated after a variation change because it has per-instance overrides or its inner block structure has diverged from the variation.',
					'%d posts were not auto-updated after a variation change because they have per-instance overrides or their inner block structure has diverged from the variation.',
					$total,
					'block-variation-manager'
				),
				$total
			)
		);
		echo ' ' . esc_html__( 'Open each post and save to pick up the latest variation values, clear the override on the affected attribute(s) first, or restore the original child structure to accept the new inner blocks.', 'block-variation-manager' );
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

				printf(
					'<li>%s%s%s%s</li>',
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- title/edit/overrides/inner built from escaped parts above.
					$title_html,
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					$edit_html,
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					$override_html,
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					$inner_html
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
