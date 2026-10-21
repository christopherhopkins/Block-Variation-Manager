/**
 * Wait until Playground actually serves WordPress before any spec runs: the
 * server accepts connections while still booting and answers with a
 * "WordPress is not ready yet" page, which otherwise fails the first test.
 */
module.exports = async ( config ) => {
	const base = config.projects[ 0 ].use.baseURL;
	const deadline = Date.now() + 300_000;
	let last = '';
	while ( Date.now() < deadline ) {
		try {
			const res = await fetch( base + '/wp-admin/', {
				redirect: 'follow',
			} );
			const text = await res.text();
			if ( res.ok && ! text.includes( 'WordPress is not ready yet' ) ) {
				return;
			}
			last = `HTTP ${ res.status }`;
		} catch ( err ) {
			last = err.message;
		}
		await new Promise( ( r ) => setTimeout( r, 5000 ) );
	}
	throw new Error( `Playground never became ready (${ last })` );
};
