<?php
/**
 * @covers \BVM\CPT
 */

use BVM\CPT;

class CptTest extends WP_UnitTestCase {

	public function test_post_type_is_registered_private_with_rest(): void {
		$type = get_post_type_object( BVM_CPT );
		$this->assertNotNull( $type );
		$this->assertFalse( (bool) $type->public );
		$this->assertTrue( (bool) $type->show_in_rest );
		$this->assertSame( 'block-variation-manager', $type->rest_base );
		$this->assertSame( 'tools.php', $type->show_in_menu );
		$this->assertFalse( (bool) $type->publicly_queryable );
	}

	public function test_title_placeholder_only_for_variations(): void {
		$variation = get_post(
			self::factory()->post->create( [ 'post_type' => BVM_CPT ] )
		);
		$regular   = get_post( self::factory()->post->create() );
		$this->assertSame( 'Variation name', CPT::title_placeholder( 'Add title', $variation ) );
		$this->assertSame( 'Add title', CPT::title_placeholder( 'Add title', $regular ) );
	}

	public function test_list_columns_inserted_after_title(): void {
		$out  = CPT::list_columns( [ 'cb' => 'x', 'title' => 'Title', 'date' => 'Date' ] );
		$keys = array_keys( $out );
		$this->assertSame( [ 'cb', 'title', 'bvm_block_type', 'bvm_usage', 'date' ], $keys );
	}

	public function test_find_block_searches_depth_first(): void {
		$blocks = parse_blocks(
			'<!-- wp:group --><div class="wp-block-group"><!-- wp:list --><ul class="wp-block-list"><!-- wp:list-item --><li>x</li><!-- /wp:list-item --></ul><!-- /wp:list --></div><!-- /wp:group -->'
		);
		$found = CPT::find_block( $blocks, 'core/list-item' );
		$this->assertNotNull( $found );
		$this->assertSame( 'core/list-item', $found['blockName'] );
		$this->assertNull( CPT::find_block( $blocks, 'core/quote' ) );
		$this->assertNull( CPT::find_block( $blocks, '' ) );
	}

	public function test_merge_with_defaults_prefers_parsed_values(): void {
		// core/heading registers level default 2.
		$merged = CPT::merge_with_defaults( 'core/heading', [ 'textAlign' => 'center' ] );
		$this->assertSame( 2, $merged['level'] );
		$this->assertSame( 'center', $merged['textAlign'] );

		$merged = CPT::merge_with_defaults( 'core/heading', [ 'level' => 4 ] );
		$this->assertSame( 4, $merged['level'] );

		// Unregistered block: attrs unchanged.
		$this->assertSame( [ 'a' => 1 ], CPT::merge_with_defaults( 'acme/nope', [ 'a' => 1 ] ) );
	}

	public function test_block_needs_bake_static_vs_dynamic(): void {
		// core/heading: static save() → bake needed.
		$this->assertTrue( CPT::block_needs_bake( 'core/heading' ) );
		// core/latest-posts: render_callback → dynamic.
		$this->assertFalse( CPT::block_needs_bake( 'core/latest-posts' ) );
		// Client-only (unregistered) blocks default to static.
		$this->assertTrue( CPT::block_needs_bake( 'acme/client-only' ) );

		$filter = static fn() => false;
		add_filter( 'bvm_block_needs_bake', $filter );
		try {
			$this->assertFalse( CPT::block_needs_bake( 'core/heading' ) );
		} finally {
			remove_filter( 'bvm_block_needs_bake', $filter );
		}
	}

	public function test_sync_captures_inner_blocks_as_tuples(): void {
		$content = '<!-- wp:group {"tagName":"section"} --><section class="wp-block-group">'
			. '<!-- wp:paragraph {"placeholder":"inner"} --><p></p><!-- /wp:paragraph -->'
			. '</section><!-- /wp:group -->';
		$vid = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_content' => $content,
			]
		);
		$tuples = CPT::get_inner_blocks( $vid );
		$this->assertCount( 1, $tuples );
		$this->assertSame( 'core/paragraph', $tuples[0][0] );
		$this->assertSame( 'inner', $tuples[0][1]['placeholder'] );
		$this->assertSame( [], $tuples[0][2] );

		// Auto-populated block_type via the fallback path.
		$this->assertSame( 'core/group', CPT::get_block_type( $vid ) );
	}

	public function test_sync_keeps_linked_children_opaque(): void {
		// §9.16: a linked child contributes only its bvmVariationId.
		$content = '<!-- wp:group --><div class="wp-block-group">'
			. '<!-- wp:heading {"level":3,"bvmVariationId":42,"textAlign":"center"} --><h3>x</h3><!-- /wp:heading -->'
			. '</div><!-- /wp:group -->';
		$vid = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_content' => $content,
			]
		);
		$tuples = CPT::get_inner_blocks( $vid );
		$this->assertSame( [ 'bvmVariationId' => 42 ], $tuples[0][1] );
	}

	public function test_sync_layers_existing_meta_as_baseline(): void {
		$vid = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_content' => '<!-- wp:paragraph {"placeholder":"a"} --><p></p><!-- /wp:paragraph -->',
			]
		);
		// Simulate an editor-resolved key the comment can never carry.
		$attrs                   = CPT::get_attrs( $vid );
		$attrs['resolvedByJs']   = 'kept';
		update_post_meta( $vid, BVM_META_ATTRS, wp_slash( wp_json_encode( $attrs ) ) );

		// Re-save (e.g. Quick Edit rename) re-syncs from content.
		wp_update_post( [ 'ID' => $vid, 'post_title' => 'Renamed' ] );

		$after = CPT::get_attrs( $vid );
		$this->assertSame( 'kept', $after['resolvedByJs'] );
		$this->assertSame( 'a', $after['placeholder'] );
	}

	public function test_sync_refuses_to_overwrite_child_only_meta_on_broken_wrapper(): void {
		$vid = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_content' => '<!-- wp:list --><ul class="wp-block-list"><!-- wp:list-item {"placeholder":"keep"} --><li>x</li><!-- /wp:list-item --></ul><!-- /wp:list -->',
			]
		);
		update_post_meta( $vid, BVM_META_BLOCK_TYPE, 'core/list-item' );
		CPT::sync_attrs_from_content( $vid, get_post( $vid ) );
		$before = CPT::get_attrs( $vid );
		$this->assertSame( 'keep', $before['placeholder'] );

		// User deletes the child: wrapper is broken. Meta must survive.
		wp_update_post(
			[
				'ID'           => $vid,
				'post_content' => '<!-- wp:list --><ul class="wp-block-list"></ul><!-- /wp:list -->',
			]
		);
		$after = CPT::get_attrs( $vid );
		$this->assertSame( 'keep', $after['placeholder'] );
		$this->assertSame( 'core/list-item', CPT::get_block_type( $vid ) );
	}

	public function test_empty_content_resets_attrs_meta(): void {
		$vid = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_content' => '<!-- wp:paragraph {"placeholder":"a"} --><p></p><!-- /wp:paragraph -->',
			]
		);
		wp_update_post( [ 'ID' => $vid, 'post_content' => '' ] );
		$this->assertSame( [], CPT::get_attrs( $vid ) );
		$this->assertSame( [], CPT::get_inner_blocks( $vid ) );
	}

	public function test_usage_queries_match_delimiter_terminated_ids_only(): void {
		$vid = 7;
		// Instance of id 7 and an instance of id 78 — prefix collision bait.
		$hit = self::factory()->post->create(
			[ 'post_content' => '<!-- wp:heading {"bvmVariationId":7} --><h2>a</h2><!-- /wp:heading -->' ]
		);
		self::factory()->post->create(
			[ 'post_content' => '<!-- wp:heading {"bvmVariationId":78} --><h2>b</h2><!-- /wp:heading -->' ]
		);

		$this->assertSame( 1, CPT::count_usage( $vid ) );
		$rows = CPT::list_usage( $vid );
		$this->assertCount( 1, $rows );
		$this->assertSame( $hit, $rows[0]['id'] );
		$this->assertSame( [ $hit ], CPT::usage_post_ids( $vid ) );
		$this->assertSame( 0, CPT::count_usage( 0 ) );
	}

	public function test_usage_post_ids_keyset_pagination(): void {
		$vid = 9;
		$ids = [];
		for ( $i = 0; $i < 3; $i++ ) {
			$ids[] = self::factory()->post->create(
				[ 'post_content' => '<!-- wp:heading {"bvmVariationId":9} --><h2>x</h2><!-- /wp:heading -->' ]
			);
		}
		sort( $ids );
		$this->assertSame( array_slice( $ids, 0, 2 ), CPT::usage_post_ids( $vid, 0, 2 ) );
		$this->assertSame( array_slice( $ids, 2 ), CPT::usage_post_ids( $vid, $ids[1], 2 ) );
	}
}
