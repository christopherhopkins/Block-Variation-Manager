<?php
/**
 * @covers \BVM\Attributes
 * @covers \BVM\CPT::sync_attrs_from_content
 */

use BVM\Attributes;
use BVM\CPT;

class AttributesTest extends WP_UnitTestCase {

	public function test_extend_injects_bookkeeping_attributes(): void {
		$args = Attributes::extend(
			[ 'attributes' => [ 'level' => [ 'type' => 'number' ] ] ],
			'core/heading'
		);
		$this->assertSame(
			[ 'type' => 'number', 'default' => 0 ],
			$args['attributes']['bvmVariationId']
		);
		$this->assertSame(
			[ 'type' => 'array', 'default' => [], 'items' => [ 'type' => 'string' ] ],
			$args['attributes']['bvmOverriddenAttrs']
		);
		$this->assertSame( [ 'type' => 'number' ], $args['attributes']['level'] );
	}

	public function test_extend_creates_attributes_bag_when_missing(): void {
		$args = Attributes::extend( [], 'core/paragraph' );
		$this->assertArrayHasKey( 'bvmVariationId', $args['attributes'] );
		$this->assertArrayHasKey( 'bvmOverriddenAttrs', $args['attributes'] );
	}

	public function test_excluded_attrs_matches_the_js_mirror(): void {
		// Pins the §9 contract mirrored in source/constants.js
		// (PRESET_EXCLUDED_ATTRS) — drive-by edits must fail loudly.
		$this->assertSame(
			[
				'bvmVariationId',
				'bvmOverriddenAttrs',
				'className',
				'anchor',
				'lock',
				'metadata',
				'uniqueID',
				'uniqueId',
			],
			Attributes::excluded_attrs()
		);
	}

	public function test_excluded_attrs_is_filterable(): void {
		$filter = static function ( array $attrs ): array {
			$attrs[] = 'vendorInstanceId';
			return $attrs;
		};
		add_filter( 'bvm_excluded_attrs', $filter );
		try {
			$this->assertContains( 'vendorInstanceId', Attributes::excluded_attrs() );
			$this->assertSame(
				[ 'keep' => 1 ],
				Attributes::strip_excluded( [ 'keep' => 1, 'vendorInstanceId' => 'x' ] )
			);
		} finally {
			remove_filter( 'bvm_excluded_attrs', $filter );
		}
	}

	public function test_strip_excluded_removes_every_excluded_key(): void {
		$attrs = [ 'level' => 2 ];
		foreach ( Attributes::excluded_attrs() as $key ) {
			$attrs[ $key ] = 'x';
		}
		$this->assertSame( [ 'level' => 2 ], Attributes::strip_excluded( $attrs ) );
	}

	/**
	 * §9.1: every DB write carrying JSON must be wp_slash()ed. A preset value
	 * containing quotes and backslashes must survive the save-sync → get_attrs
	 * round-trip byte-for-byte; an unslashed write corrupts the stored JSON.
	 */
	public function test_sync_attrs_slash_round_trip(): void {
		$text    = 'He said "hi" — path C:\\temp\\x and a \\" literal';
		$content = '<!-- wp:paragraph ' . wp_json_encode( [ 'placeholder' => $text ] ) . ' --><p></p><!-- /wp:paragraph -->';

		$variation_id = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'publish',
				'post_title'   => 'Slash test',
				// Factory input flows through wp_insert_post, which unslashes.
				'post_content' => wp_slash( $content ),
			]
		);

		$attrs = CPT::get_attrs( $variation_id );
		$this->assertIsArray( $attrs );
		$this->assertSame( $text, $attrs['placeholder'] );
	}

	public function test_get_attrs_is_publish_gated(): void {
		$variation_id = self::factory()->post->create(
			[
				'post_type'    => BVM_CPT,
				'post_status'  => 'draft',
				'post_content' => '<!-- wp:paragraph {"placeholder":"x"} --><p></p><!-- /wp:paragraph -->',
			]
		);
		$this->assertNull( CPT::get_attrs( $variation_id ) );

		wp_publish_post( $variation_id );
		$attrs = CPT::get_attrs( $variation_id );
		$this->assertIsArray( $attrs );
		$this->assertSame( 'x', $attrs['placeholder'] );
	}
}
