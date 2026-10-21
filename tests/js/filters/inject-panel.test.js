import { render, screen } from '@testing-library/react';

const mockAddFilter = jest.fn();
jest.mock( '@wordpress/hooks', () => ( { addFilter: mockAddFilter } ) );

jest.mock( '../../../source/components/VariationPanel.js', () => ( {
	__esModule: true,
	default: ( { name } ) => <div data-testid="variation-panel">{ name }</div>,
} ) );

require( '../../../source/filters/inject-panel.js' );

const hoc = mockAddFilter.mock.calls.find(
	( c ) => c[ 1 ] === 'bvm/inject-panel'
)[ 2 ];

const BlockEdit = () => <div data-testid="block-edit" />;
const Wrapped = hoc( BlockEdit );

const baseProps = {
	name: 'core/heading',
	isSelected: true,
	attributes: {},
	setAttributes: () => {},
	clientId: 'c1',
};

afterEach( () => {
	delete window.BVM;
} );

describe( 'inject-panel filter', () => {
	it( 'registers on editor.BlockEdit', () => {
		expect( mockAddFilter ).toHaveBeenCalledWith(
			'editor.BlockEdit',
			'bvm/inject-panel',
			expect.any( Function )
		);
	} );

	it( 'renders the panel for a selected, eligible block', () => {
		render( <Wrapped { ...baseProps } /> );
		expect( screen.getByTestId( 'block-edit' ) ).toBeTruthy();
		expect( screen.getByTestId( 'variation-panel' ) ).toBeTruthy();
	} );

	it( 'skips unselected blocks', () => {
		render( <Wrapped { ...baseProps } isSelected={ false } /> );
		expect( screen.queryByTestId( 'variation-panel' ) ).toBeNull();
	} );

	it.each( [ 'core/freeform', 'core/missing', 'core/block' ] )(
		'skips blocklisted type %s',
		( name ) => {
			render( <Wrapped { ...baseProps } name={ name } /> );
			expect( screen.queryByTestId( 'variation-panel' ) ).toBeNull();
		}
	);

	it( 'skips everything inside the variation editor itself', () => {
		window.BVM = { isVariationEditor: true };
		render( <Wrapped { ...baseProps } /> );
		expect( screen.queryByTestId( 'variation-panel' ) ).toBeNull();
		expect( screen.getByTestId( 'block-edit' ) ).toBeTruthy();
	} );
} );
