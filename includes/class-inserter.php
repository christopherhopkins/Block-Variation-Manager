<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

/**
 * Surface each published bvm_variation as a block-inserter variation
 * for its associated block type. Inserting one pre-populates bvmVariationId
 * so the render-time merge takes over for every attribute the user hasn't set.
 */
class Inserter {

	/** @var array<string,array<int,array<string,mixed>>>|null */
	private static $definitions = null;

	public static function init(): void {
		add_filter( 'get_block_type_variations', [ self::class, 'add_variations' ], 10, 2 );
		// Keep the request cache fresh if a variation is saved mid-request.
		add_action( 'save_post_' . BVM_CPT, [ self::class, 'flush_cache' ] );
	}

	public static function flush_cache(): void {
		self::$definitions = null;
	}

	/**
	 * @param array<int,array<string,mixed>> $variations
	 * @return array<int,array<string,mixed>>
	 */
	public static function add_variations( array $variations, \WP_Block_Type $block_type ): array {
		$map = self::definitions();
		foreach ( $map[ $block_type->name ] ?? [] as $cpt_variation ) {
			$variations[] = $cpt_variation;
		}
		return $variations;
	}

	/**
	 * All published variation definitions grouped by block type, built once
	 * per request.
	 *
	 * The get_block_type_variations filter fires once per registered block
	 * type per editor settings build — 150-400 types on a core+Kadence site —
	 * and the previous implementation ran a fresh get_posts + meta_query for
	 * every call: hundreds of posts↔postmeta JOIN queries per editor load,
	 * even with zero saved variations. One query (plus a meta-cache prime)
	 * now serves every call as an array lookup.
	 *
	 * @return array<string,array<int,array<string,mixed>>>
	 */
	private static function definitions(): array {
		if ( null !== self::$definitions ) {
			return self::$definitions;
		}
		self::$definitions = [];

		$posts = get_posts(
			[
				'post_type'              => BVM_CPT,
				'post_status'            => 'publish',
				// Global cap across all block types (the old per-type query
				// capped at 200 per type). Sites with more variations than
				// this have bigger problems, but don't fetch unbounded.
				'posts_per_page'         => 500,
				'orderby'                => 'title',
				'order'                  => 'ASC',
				'update_post_term_cache' => false,
			]
		);

		foreach ( $posts as $post ) {
			$block_name = CPT::get_block_type( $post->ID );
			if ( null === $block_name ) {
				continue;
			}

			$attrs                       = CPT::get_attrs( $post->ID ) ?? [];
			$attrs['bvmVariationId']     = $post->ID;
			$attrs['bvmOverriddenAttrs'] = [];

			$definition = [
				'name'        => 'bvm-' . $post->ID,
				'title'       => $post->post_title,
				'description' => sprintf(
					/* translators: %s: variation name */
					__( 'Custom block variation: %s', 'block-variation-manager' ),
					$post->post_title
				),
				'scope'       => [ 'inserter', 'transform' ],
				'attributes'  => $attrs,
			];

			// Attach the saved inner-block template so inserting the
			// variation pre-populates its structure. Inner blocks are
			// instance-local after insert — only the root attrs above
			// propagate at render time. Already stored as Gutenberg's
			// nested-tuple shape: [ [ name, attrs, innerBlocks[] ], ... ].
			$inner_blocks = CPT::get_inner_blocks( $post->ID );
			if ( ! empty( $inner_blocks ) ) {
				$definition['innerBlocks'] = $inner_blocks;
			}

			self::$definitions[ $block_name ][] = $definition;
		}

		return self::$definitions;
	}
}
