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
	public static function init(): void {
		add_filter( 'get_block_type_variations', [ self::class, 'add_variations' ], 10, 2 );
	}

	/**
	 * @param array<int,array<string,mixed>> $variations
	 * @return array<int,array<string,mixed>>
	 */
	public static function add_variations( array $variations, \WP_Block_Type $block_type ): array {
		foreach ( self::variations_for( $block_type->name ) as $cpt_variation ) {
			$variations[] = $cpt_variation;
		}
		return $variations;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	private static function variations_for( string $block_name ): array {
		$posts = get_posts(
			[
				'post_type'      => BVM_CPT,
				'post_status'    => 'publish',
				'posts_per_page' => 200,
				'meta_query'     => [
					[
						'key'   => BVM_META_BLOCK_TYPE,
						'value' => $block_name,
					],
				],
				'orderby'        => 'title',
				'order'          => 'ASC',
			]
		);

		$result = [];
		foreach ( $posts as $post ) {
			$attrs = CPT::get_attrs( $post->ID ) ?? [];
			$attrs['bvmVariationId']     = $post->ID;
			$attrs['bvmOverriddenAttrs'] = [];

			$variation = [
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

			// For parent blocks with required children (kadence/accordion+pane,
			// kadence/advancedbtn+singlebtn, etc.), restore the captured tree.
			// Gutenberg's variation `innerBlocks` shape is recursive nested
			// triples: [ [ name, attributes, innerBlocks[] ], ... ].
			$inner = CPT::get_inner_blocks( $post->ID );
			if ( ! empty( $inner ) ) {
				$variation['innerBlocks'] = self::shape_for_inserter( $inner );
			}

			$result[] = $variation;
		}
		return $result;
	}

	/**
	 * Convert the stored { name, attributes, innerBlocks } tree into the
	 * nested-triple shape Gutenberg's block variations expect.
	 *
	 * @param array<int,array{name:string,attributes:array<string,mixed>,innerBlocks:array<int,mixed>}> $tree
	 * @return array<int,array{0:string,1:array<string,mixed>,2:array<int,mixed>}>
	 */
	private static function shape_for_inserter( array $tree ): array {
		$out = [];
		foreach ( $tree as $node ) {
			if ( empty( $node['name'] ) ) {
				continue;
			}
			$attrs    = is_array( $node['attributes'] ?? null ) ? $node['attributes'] : [];
			$children = is_array( $node['innerBlocks'] ?? null ) ? $node['innerBlocks'] : [];
			$out[]    = [
				$node['name'],
				$attrs,
				self::shape_for_inserter( $children ),
			];
		}
		return $out;
	}
}
