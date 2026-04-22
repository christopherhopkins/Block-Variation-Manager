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

/**
 * Recursively turn [name, attrs, innerBlocks] tuples (the shape we persist
 * in _bvm_variation_inner_blocks) into a tree of block objects ready for
 * replaceInnerBlocks(). createBlock()'s third arg wants block objects, not
 * tuples, so the recursion is necessary.
 */
function tuplesToBlocks( template ) {
	if ( ! Array.isArray( template ) ) return [];
	return template.map( ( [ name, attrs, inner ] ) =>
		createBlock(
			name,
			attrs && typeof attrs === 'object' ? attrs : {},
			tuplesToBlocks( inner )
		)
	);
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
	// Template the user is deciding whether to drop into the block. Only
	// populated when a variation with inner blocks is picked. null = no
	// pending decision; array = dialog open.
	const [ pendingTemplate, setPendingTemplate ] = useState( null );

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

	const onPickVariation = ( value ) => {
		const id = parseInt( value, 10 );
		setAttributes( {
			[ BVM_ATTR_VARIATION_ID ]: id,
			[ BVM_ATTR_OVERRIDES ]: [],
		} );
		if ( id > 0 ) {
			const picked = list?.find( ( v ) => v.id === id );
			noticeSuccess(
				sprintf(
					/* translators: %s: variation title */
					__( 'Applied variation: %s', 'block-variation-manager' ),
					picked?.title ??
						__( 'variation', 'block-variation-manager' )
				)
			);
			// If the variation has a saved inner-block template, let the
			// user decide whether to drop it in or keep the block's
			// existing structure. Attrs are already applied above either
			// way — only root attrs propagate.
			const template = Array.isArray( picked?.inner_blocks )
				? picked.inner_blocks
				: [];
			if ( template.length > 0 && clientId ) {
				setPendingTemplate( template );
			}
		}
	};

	const onApplyTemplate = () => {
		if ( ! pendingTemplate || ! clientId ) {
			setPendingTemplate( null );
			return;
		}
		const blocks = tuplesToBlocks( pendingTemplate );
		// updateSelection=false keeps the user's current selection on the
		// block they just applied the variation to, rather than jumping
		// into the newly-inserted inner blocks.
		dispatch( 'core/block-editor' ).replaceInnerBlocks(
			clientId,
			blocks,
			false
		);
		setPendingTemplate( null );
		noticeSuccess(
			__(
				'Replaced inner blocks with the variation template.',
				'block-variation-manager'
			)
		);
	};

	const onKeepInnerBlocks = () => setPendingTemplate( null );

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

			{ pendingTemplate && (
				<ConfirmDialog
					onConfirm={ onApplyTemplate }
					onCancel={ onKeepInnerBlocks }
					confirmButtonText={ __(
						'Replace inner blocks',
						'block-variation-manager'
					) }
					cancelButtonText={ __(
						'Keep current inner blocks',
						'block-variation-manager'
					) }
				>
					{ __(
						'This variation ships with its own inner blocks. Replace this block’s inner blocks with the variation’s template, or keep the current ones and only apply the variation to this parent block?',
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

function SavePanel( { attributes, setAttributes, name, list } ) {
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
			const block = createBlock( name, preset );
			const content = serialize( block );
			const created = await createVariation( {
				title: trimmed,
				blockType: name,
				attrs: preset,
				content,
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
				list={ list }
			/>
		</InspectorControls>
	);
}
