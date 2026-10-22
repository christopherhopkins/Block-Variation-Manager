<?php
/**
 * QUA-21: the PHP side of the PHP↔JS mirror contract — same fixture as
 * tests/js/mirror-contract.test.js.
 *
 * @covers \BVM\Attributes::excluded_attrs
 * @covers \BVM\Rest
 * @covers \BVM\CPT
 */

use BVM\Attributes;
use BVM\CPT;
use BVM\Rest;

class MirrorContractTest extends WP_UnitTestCase {

	private static function contract(): array {
		return json_decode(
			file_get_contents( dirname( __DIR__ ) . '/fixtures/mirror-contract.json' ),
			true
		);
	}

	public function test_excluded_attrs_matches_the_shared_contract(): void {
		$expected = self::contract()['excludedAttrs'];
		$actual   = Attributes::excluded_attrs();
		sort( $expected );
		sort( $actual );
		$this->assertSame( $expected, $actual );
	}

	public function test_sanitize_inner_tree_reproduces_the_contract_capture(): void {
		$contract = self::contract()['linkedChildCapture'];
		$method   = new ReflectionMethod( Rest::class, 'sanitize_inner_tree' );
		$method->setAccessible( true );
		$this->assertSame(
			$contract['expectedTuples'],
			$method->invoke( null, $contract['inputObjects'] )
		);
	}

	public function test_blocks_to_tuples_keeps_linked_children_opaque_like_the_contract(): void {
		// blocks_to_tuples consumes parse_blocks() shape; derive it from the
		// contract's object shape so all three implementations share inputs.
		// Unlike the other two mirrors it also merges the server's registered
		// defaults into non-linked nodes (by design — see merge_with_defaults),
		// so the contract here is: linked children carry EXACTLY their link,
		// excluded attrs are stripped everywhere, and every contract attr
		// survives — not byte equality.
		$to_parsed = static function ( array $nodes ) use ( &$to_parsed ): array {
			return array_map(
				static fn( $n ) => [
					'blockName'   => $n['name'],
					'attrs'       => $n['attributes'],
					'innerBlocks' => $to_parsed( $n['innerBlocks'] ),
				],
				$nodes
			);
		};
		$contract = self::contract()['linkedChildCapture'];
		$method   = new ReflectionMethod( CPT::class, 'blocks_to_tuples' );
		$method->setAccessible( true );
		$tuples   = $method->invoke( null, $to_parsed( $contract['inputObjects'] ) );
		$excluded = self::contract()['excludedAttrs'];

		$assert_node = function ( array $expected, array $tuple ) use ( &$assert_node, $excluded ) {
			$this->assertSame( $expected[0], $tuple[0] );
			$is_linked = isset( $expected[1]['bvmVariationId'] );
			if ( $is_linked ) {
				// §9.16: a linked child is exactly its link, nothing else.
				$this->assertSame( $expected[1], $tuple[1] );
			} else {
				foreach ( $expected[1] as $k => $v ) {
					$this->assertSame( $v, $tuple[1][ $k ] ?? null, "attr $k" );
				}
				foreach ( $excluded as $k ) {
					$this->assertArrayNotHasKey( $k, $tuple[1], "excluded attr $k leaked" );
				}
			}
			$this->assertSameSize( $expected[2], $tuple[2] );
			foreach ( $expected[2] as $i => $child ) {
				$assert_node( $child, $tuple[2][ $i ] );
			}
		};
		$this->assertSameSize( $contract['expectedTuples'], $tuples );
		foreach ( $contract['expectedTuples'] as $i => $expected ) {
			$assert_node( $expected, $tuples[ $i ] );
		}
	}
}
