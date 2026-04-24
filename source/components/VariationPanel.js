import { __, sprintf, _n } from '@wordpress/i18n';
import { InspectorControls } from '@wordpress/block-editor';
import {
	PanelBody,
	Button,
	SelectControl,
	TextControl,
	Notice,
	Flex,
	FlexItem,
	Dropdown,
	MenuGroup,
	MenuItem,
	__experimentalHStack as HStack,
	__experimentalText as Text,
	__experimentalConfirmDialog as ConfirmDialog,
} from '@wordpress/components';
import {
	useState,
	useEffect,
	useMemo,
	useSyncExternalStore,
} from '@wordpress/element';
import { createBlock, serialize } from '@wordpress/blocks';
import { dispatch, select } from '@wordpress/data';
import {
	subscribe,
	listForBlockType,
	createVariation,
	getCached,
	ensureVariationLoaded,
} from '../lib/variation-store.js';
import {
	ensureRegistryLoaded,
	hasRequiredChildren,
} from '../lib/block-registry.js';
import {
	BVM_ATTR_VARIATION_ID,
	BVM_ATTR_OVERRIDES,
	INTERNAL_ATTRS,
} from '../constants.js';

/** Sentinel cache key used to re-render on any variation-store invalidation. */
const STORE_TICK_KEY = -1;

function useVariationsForBlock( blockName ) {
	const [ list, setList ] = useState( null );
	const [ error, setError ] = useState( null );

	useSyncExternalStore( subscribe, () => getCached( STORE_TICK_KEY ) );

	useEffect( () => {
		let cancelled = false;
		setError( null );
		listForBlockType( blockName )
			.then( ( data ) => {
				if ( ! cancelled ) setList( data );
			} )
			.catch( ( err ) => {
				if ( ! cancelled ) setError( err.message || String( err ) );
			} );
		return () => {
			cancelled = true;
		};
	}, [ blockName ] );

	return { list, error };
}

function useVariationSnapshot( variationId ) {
	useEffect( () => {
		ensureVariationLoaded( variationId );
	}, [ variationId ] );
	return useSyncExternalStore(
		subscribe,
		() => ( variationId ? getCached( variationId ) : null )
	);
}

function extractPresetAttrs( attributes ) {
	const out = {};
	for ( const [ key, value ] of Object.entries( attributes ) ) {
		if ( INTERNAL_ATTRS.has( key ) ) continue;
		if ( value === undefined ) continue;
		out[ key ] = value;
	}
	return out;
}

/**
 * Recursively shape a tree of editor block objects into the
 * { name, attributes, innerBlocks } payload the REST endpoint stores.
 * Strips BVM bookkeeping attrs and undefined values.
 */
function shapeInnerBlocks( blocks ) {
	if ( ! Array.isArray( blocks ) ) return [];
	return blocks
		.filter( ( b ) => b && typeof b.name === 'string' && b.name !== '' )
		.map( ( b ) => ( {
			name: b.name,
			attributes: extractPresetAttrs( b.attributes ?? {} ),
			innerBlocks: shapeInnerBlocks( b.innerBlocks ),
		} ) );
}

/**
 * Build a tree of `createBlock()` instances from a stored
 * { name, attributes, innerBlocks } variation tree, ready to hand to
 * `replaceInnerBlocks`.
 */
function buildBlocksFromTree( tree ) {
	if ( ! Array.isArray( tree ) ) return [];
	return tree
		.filter( ( node ) => node && typeof node.name === 'string' && node.name !== '' )
		.map( ( node ) =>
			createBlock(
				node.name,
				node.attributes ?? {},
				buildBlocksFromTree( node.innerBlocks )
			)
		);
}

/** Kadence class-pair convention: `fooClass` ↔ `foo`. */
function kadenceClassPair( key ) {
	if ( key.endsWith( 'Class' ) && key.length > 5 ) {
		return key.slice( 0, -5 );
	}
	return key + 'Class';
}

/** Base key for a class-pair — strips `Class` suffix when present. */
function pairBaseKey( key ) {
	return key.endsWith( 'Class' ) && key.length > 5
		? key.slice( 0, -5 )
		: key;
}

/**
 * Collapse class-pair overrides into a single entry keyed by the base name.
 * e.g. ['bgColor','bgColorClass','minHeight'] → ['bgColor','minHeight'].
 */
function collapsePairs( overrides ) {
	const seen = new Set();
	const out = [];
	for ( const key of overrides ) {
		const base = pairBaseKey( key );
		if ( seen.has( base ) ) continue;
		seen.add( base );
		out.push( base );
	}
	return out;
}

function noticeSuccess( message ) {
	const notices = dispatch( 'core/notices' );
	notices?.createNotice?.( 'success', message, {
		type: 'snackbar',
		isDismissible: true,
	} );
}

function SourcePanel( {
	attributes,
	setAttributes,
	clientId,
	list,
	listError,
	openInitial,
} ) {
	const variationId = attributes?.[ BVM_ATTR_VARIATION_ID ] || 0;
	const overrides = Array.isArray( attributes?.[ BVM_ATTR_OVERRIDES ] )
		? attributes[ BVM_ATTR_OVERRIDES ]
		: [];
	const activeVariation = useVariationSnapshot( variationId );
	const [ confirmUnlink, setConfirmUnlink ] = useState( false );
	// When user picks a variation that includes inner blocks AND the live
	// block already has children, defer the assignment until they confirm
	// whether to replace or keep existing children.
	// Shape: { id, title, innerBlocks }
	const [ pendingApply, setPendingApply ] = useState( null );

	const options = useMemo( () => {
		const opts = [
			{ label: __( '— None —', 'block-variation-manager' ), value: '0' },
		];
		if ( list ) {
			for ( const v of list ) {
				opts.push( { label: v.title, value: String( v.id ) } );
			}
		}
		return opts;
	}, [ list ] );

	const collapsedOverrides = useMemo(
		() => collapsePairs( overrides ),
		[ overrides ]
	);

	const isOrphaned = variationId > 0 && activeVariation === null;

	const finalizePick = ( id, title, replaceChildren, sourceInner ) => {
		setAttributes( {
			[ BVM_ATTR_VARIATION_ID ]: id,
			[ BVM_ATTR_OVERRIDES ]: [],
		} );
		if ( replaceChildren && clientId && Array.isArray( sourceInner ) ) {
			const blocks = buildBlocksFromTree( sourceInner );
			dispatch( 'core/block-editor' )?.replaceInnerBlocks?.(
				clientId,
				blocks,
				false
			);
		}
		if ( id > 0 ) {
			noticeSuccess(
				sprintf(
					/* translators: %s: variation title */
					__( 'Applied variation: %s', 'block-variation-manager' ),
					title ?? __( 'variation', 'block-variation-manager' )
				)
			);
		}
	};

	const onPickVariation = async ( value ) => {
		const id = parseInt( value, 10 );
		if ( id <= 0 ) {
			finalizePick( id, null, false, null );
			return;
		}
		const picked = list?.find( ( v ) => v.id === id );
		// We need the full variation record (cached or freshly fetched) to
		// know whether the source has inner blocks worth restoring. The
		// list endpoint already returns inner_blocks per row, but cache may
		// not be warm if the user opened the dropdown immediately.
		const loaded = await ensureVariationLoaded( id );
		const sourceInner = Array.isArray( loaded?.inner_blocks )
			? loaded.inner_blocks
			: [];
		const existingChildren = clientId
			? select( 'core/block-editor' )?.getBlocks?.( clientId ) ?? []
			: [];

		// No inner blocks on the source → behave like before; attr-only sync.
		if ( sourceInner.length === 0 ) {
			finalizePick( id, picked?.title, false, null );
			return;
		}
		// Source has inner blocks but the target is empty → restore silently.
		if ( existingChildren.length === 0 ) {
			finalizePick( id, picked?.title, true, sourceInner );
			return;
		}
		// Both sides have children — ask before clobbering the user's work.
		setPendingApply( {
			id,
			title: picked?.title,
			innerBlocks: sourceInner,
		} );
	};

	const onEditSource = () => {
		if ( ! variationId ) return;
		const adminUrl = window.BVM?.adminUrl ?? '/wp-admin/post.php';
		window.open(
			`${ adminUrl }?post=${ variationId }&action=edit`,
			'_blank',
			'noopener,noreferrer'
		);
	};

	const onUnlink = () => {
		setAttributes( {
			[ BVM_ATTR_VARIATION_ID ]: 0,
			[ BVM_ATTR_OVERRIDES ]: [],
		} );
		setConfirmUnlink( false );
		noticeSuccess(
			__( 'Block unlinked from its variation.', 'block-variation-manager' )
		);
	};

	/**
	 * Reset a single override chip. The chip is keyed by the base-name
	 * (pair-collapsed), so we always remove both halves of a class-pair and
	 * restore both sides from the variation.
	 */
	const onResetAttr = ( baseKey ) => {
		if ( ! activeVariation ) return;
		const pair = kadenceClassPair( baseKey );
		const toRemove = new Set( [ baseKey, pair ] );
		const next = overrides.filter( ( k ) => ! toRemove.has( k ) );
		const update = { [ BVM_ATTR_OVERRIDES ]: next };
		for ( const k of toRemove ) {
			if (
				Object.prototype.hasOwnProperty.call(
					activeVariation.attrs,
					k
				)
			) {
				update[ k ] = activeVariation.attrs[ k ];
			}
		}
		setAttributes( update );
	};

	const onResetAll = () => {
		if ( ! activeVariation ) return;
		const update = { [ BVM_ATTR_OVERRIDES ]: [] };
		for ( const key of overrides ) {
			if (
				Object.prototype.hasOwnProperty.call(
					activeVariation.attrs,
					key
				)
			) {
				update[ key ] = activeVariation.attrs[ key ];
			}
		}
		setAttributes( update );
		noticeSuccess(
			__(
				'Reset all overrides to the variation.',
				'block-variation-manager'
			)
		);
	};

	const overrideCount = collapsedOverrides.length;
	const header =
		variationId > 0 && overrideCount > 0
			? sprintf(
					/* translators: %d: number of overridden attributes */
					_n(
						'Variation source · %d override',
						'Variation source · %d overrides',
						overrideCount,
						'block-variation-manager'
					),
					overrideCount
			  )
			: __( 'Variation source', 'block-variation-manager' );

	return (
		<PanelBody title={ header } initialOpen={ openInitial }>
			{ listError && (
				<Notice status="error" isDismissible={ false }>
					{ listError }
				</Notice>
			) }

			{ isOrphaned && (
				<Notice status="warning" isDismissible={ false }>
					{ __(
						'This block references a variation that no longer exists. Rebind below or unlink.',
						'block-variation-manager'
					) }
				</Notice>
			) }

			<SelectControl
				label={ __( 'Apply', 'block-variation-manager' ) }
				value={ String( variationId ) }
				options={ options }
				onChange={ onPickVariation }
				help={
					list && list.length === 0
						? __(
								'No variations yet. Style a block and save it as a variation below.',
								'block-variation-manager'
						  )
						: undefined
				}
				__nextHasNoMarginBottom
			/>

			{ variationId > 0 && activeVariation && overrideCount > 0 && (
				<div style={ { marginTop: 12 } }>
					<Text size="11" weight="600" upperCase>
						{ __(
							'Overrides on this instance',
							'block-variation-manager'
						) }
					</Text>
					<Text
						as="p"
						variant="muted"
						size="12"
						style={ { marginTop: 4, marginBottom: 6 } }
					>
						{ __(
							'Click a chip to reset that attribute to the variation value.',
							'block-variation-manager'
						) }
					</Text>
					<HStack
						wrap
						spacing={ 1 }
						justify="flex-start"
					>
						{ collapsedOverrides.map( ( key ) => (
							<Button
								key={ key }
								variant="secondary"
								size="compact"
								onClick={ () => onResetAttr( key ) }
								label={ sprintf(
									/* translators: %s: attribute name */
									__(
										'Reset %s to variation',
										'block-variation-manager'
									),
									key
								) }
								showTooltip
							>
								{ key } ×
							</Button>
						) ) }
						<Button
							variant="tertiary"
							size="compact"
							onClick={ onResetAll }
						>
							{ __(
								'Reset all overrides',
								'block-variation-manager'
							) }
						</Button>
					</HStack>
				</div>
			) }

			{ variationId > 0 && (
				<Flex gap={ 2 } wrap style={ { marginTop: 12 } } justify="flex-start">
					<FlexItem>
						<Button
							variant="secondary"
							onClick={ onEditSource }
							disabled={ ! variationId }
						>
							{ __( 'Edit source', 'block-variation-manager' ) }
						</Button>
					</FlexItem>
					<FlexItem>
						<Dropdown
							popoverProps={ { placement: 'bottom-end' } }
							renderToggle={ ( { onToggle, isOpen } ) => (
								<Button
									variant="tertiary"
									onClick={ onToggle }
									aria-expanded={ isOpen }
									disabled={ confirmUnlink }
								>
									{ __(
										'More',
										'block-variation-manager'
									) }
								</Button>
							) }
							renderContent={ ( { onClose } ) => (
								<MenuGroup>
									<MenuItem
										isDestructive
										onClick={ () => {
											onClose();
											setConfirmUnlink( true );
										} }
									>
										{ __(
											'Unlink from variation',
											'block-variation-manager'
										) }
									</MenuItem>
								</MenuGroup>
							) }
						/>
					</FlexItem>
				</Flex>
			) }

			{ confirmUnlink && (
				<ConfirmDialog
					onConfirm={ onUnlink }
					onCancel={ () => setConfirmUnlink( false ) }
					confirmButtonText={ __(
						'Unlink',
						'block-variation-manager'
					) }
				>
					{ __(
						'Unlink this block from its variation? It will keep its current values but stop receiving future updates.',
						'block-variation-manager'
					) }
				</ConfirmDialog>
			) }

			{ pendingApply && (
				<ConfirmDialog
					onConfirm={ () => {
						const p = pendingApply;
						setPendingApply( null );
						finalizePick( p.id, p.title, true, p.innerBlocks );
					} }
					onCancel={ () => {
						const p = pendingApply;
						setPendingApply( null );
						// User opted to keep existing children — apply
						// attrs only, don't touch innerBlocks.
						finalizePick( p.id, p.title, false, null );
					} }
					confirmButtonText={ __(
						'Replace children',
						'block-variation-manager'
					) }
					cancelButtonText={ __(
						'Keep existing children',
						'block-variation-manager'
					) }
				>
					{ __(
						'This variation includes child blocks. Replace this block\u2019s existing children with the variation\u2019s, or keep the current ones?',
						'block-variation-manager'
					) }
				</ConfirmDialog>
			) }

			<Text
				as="p"
				variant="muted"
				size="12"
				style={ { marginTop: 12 } }
			>
				{ __(
					'Changes to the source variation propagate here automatically, except for attributes you override on this instance.',
					'block-variation-manager'
				) }
			</Text>
		</PanelBody>
	);
}

function SavePanel( { attributes, setAttributes, name, clientId, list } ) {
	const [ newName, setNewName ] = useState( '' );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ saveError, setSaveError ] = useState( null );
	const [ pendingConfirm, setPendingConfirm ] = useState( null );

	const trimmed = newName.trim();
	const duplicate = useMemo(
		() =>
			list
				? list.some(
						( v ) =>
							v.title.toLowerCase() === trimmed.toLowerCase()
				  )
				: false,
		[ list, trimmed ]
	);

	const performSave = async ( shouldCommitPost ) => {
		setIsSaving( true );
		setSaveError( null );
		try {
			const preset = extractPresetAttrs( attributes );

			// Capture the full live inner-block tree if the registry says
			// this block has required children (e.g. kadence/advancedbtn
			// with kadence/singlebtn children). Reading via getBlocks
			// gives us resolved attrs from the editor, not the lossy
			// serialized comment representation.
			let innerBlocks;
			if ( clientId && hasRequiredChildren( name ) ) {
				const children = select( 'core/block-editor' )?.getBlocks?.(
					clientId
				);
				if ( Array.isArray( children ) && children.length > 0 ) {
					innerBlocks = shapeInnerBlocks( children );
				}
			}

			const block = createBlock(
				name,
				preset,
				Array.isArray( innerBlocks )
					? buildBlocksFromTree( innerBlocks )
					: []
			);
			const content = serialize( block );
			const created = await createVariation( {
				title: trimmed,
				blockType: name,
				attrs: preset,
				content,
				innerBlocks,
			} );
			setAttributes( {
				[ BVM_ATTR_VARIATION_ID ]: created.id,
				[ BVM_ATTR_OVERRIDES ]: [],
			} );
			setNewName( '' );
			noticeSuccess(
				sprintf(
					/* translators: %s: variation title */
					__(
						'Variation "%s" created.',
						'block-variation-manager'
					),
					created.title
				)
			);
			if ( shouldCommitPost ) {
				const editorStore = dispatch( 'core/editor' );
				if ( editorStore?.savePost ) {
					try {
						await editorStore.savePost();
					} catch ( _err ) {
						// Non-fatal — variation was created.
					}
				}
			}
		} catch ( err ) {
			setSaveError( err.message || String( err ) );
		} finally {
			setIsSaving( false );
			setPendingConfirm( null );
		}
	};

	const onSave = () => {
		// If the post has dirty state other than our pending linkage, the
		// post-save that counts this variation as its first instance would
		// also commit everything else. Confirm before doing that.
		const editor = select( 'core/editor' );
		const isDirty = editor?.isEditedPostDirty?.() ?? false;
		if ( isDirty ) {
			setPendingConfirm( 'dirty' );
			return;
		}
		// Post is clean — we need to save after linking so the usage count
		// picks it up. No user surprise because there are no other changes.
		performSave( true );
	};

	return (
		<PanelBody
			title={ __( 'Save as variation', 'block-variation-manager' ) }
			initialOpen={ false }
		>
			<TextControl
				label={ __( 'Name', 'block-variation-manager' ) }
				value={ newName }
				onChange={ setNewName }
				placeholder={ __(
					'e.g. Brand hero',
					'block-variation-manager'
				) }
				__nextHasNoMarginBottom
			/>
			{ trimmed && duplicate && (
				<Notice status="warning" isDismissible={ false }>
					{ __(
						'A variation with this name already exists. Saving will create a second one.',
						'block-variation-manager'
					) }
				</Notice>
			) }
			<Button
				variant="primary"
				onClick={ onSave }
				disabled={ isSaving || ! trimmed }
				style={ { marginTop: 8 } }
			>
				{ isSaving
					? __( 'Saving…', 'block-variation-manager' )
					: __( 'Save variation', 'block-variation-manager' ) }
			</Button>
			{ saveError && (
				<Notice status="error" isDismissible={ false }>
					{ saveError }
				</Notice>
			) }
			<Text as="p" variant="muted" size="12" style={ { marginTop: 12 } }>
				{ __(
					"The current block's attributes become the new variation's defaults. You can edit it later from Tools → Block Variations.",
					'block-variation-manager'
				) }
			</Text>

			{ pendingConfirm === 'dirty' && (
				<ConfirmDialog
					onConfirm={ () => performSave( true ) }
					onCancel={ () => {
						// Create the variation but don't auto-save the post.
						// The block's link will persist on next manual save.
						setPendingConfirm( null );
						performSave( false );
					} }
					confirmButtonText={ __(
						'Save page and variation',
						'block-variation-manager'
					) }
					cancelButtonText={ __(
						'Create variation only',
						'block-variation-manager'
					) }
				>
					{ __(
						'This page has unsaved changes. Saving the variation now will also commit those changes to the page. Proceed, or create the variation without saving the page?',
						'block-variation-manager'
					) }
				</ConfirmDialog>
			) }
		</PanelBody>
	);
}

export default function VariationPanel( {
	attributes,
	setAttributes,
	name,
	clientId,
} ) {
	const variationId = attributes?.[ BVM_ATTR_VARIATION_ID ] || 0;
	const { list, error } = useVariationsForBlock( name );

	// Lazy-load the block-policy registry once; cheap no-op after first call.
	useEffect( () => {
		ensureRegistryLoaded();
	}, [] );

	return (
		<InspectorControls>
			<SourcePanel
				attributes={ attributes }
				setAttributes={ setAttributes }
				clientId={ clientId }
				list={ list }
				listError={ error }
				openInitial={ variationId > 0 }
			/>
			<SavePanel
				attributes={ attributes }
				setAttributes={ setAttributes }
				name={ name }
				clientId={ clientId }
				list={ list }
			/>
		</InspectorControls>
	);
}
