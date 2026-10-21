#!/usr/bin/env node
/**
 * Boot WordPress Playground for the Playwright E2E suite: the working tree
 * mounted as the plugin (like playground:local), on a fixed port with
 * auto-login so tests land in wp-admin directly.
 *
 * Port: BVM_E2E_PORT (default 9488) — must match playwright.config.cjs.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const repoRoot = resolve( __dirname, '..' );
const sourceBlueprint = resolve( repoRoot, 'blueprint.json' );
const localBlueprint = resolve( repoRoot, '.blueprint.e2e.json' );
const port = process.env.BVM_E2E_PORT || '9488';

const original = JSON.parse( readFileSync( sourceBlueprint, 'utf8' ) );
const filtered = {
	...original,
	// Tests drive specific URLs themselves.
	landingPage: '/wp-admin/',
	steps: original.steps.filter(
		( s ) => ! ( s.step === 'installPlugin' && s?.pluginData?.resource === 'git:directory' )
	),
};
writeFileSync( localBlueprint, JSON.stringify( filtered, null, 2 ) );

const cleanup = () => {
	try { unlinkSync( localBlueprint ); } catch ( e ) { /* ignore */ }
};
process.on( 'SIGINT', () => { cleanup(); process.exit( 0 ); } );
process.on( 'SIGTERM', () => { cleanup(); process.exit( 0 ); } );
process.on( 'exit', cleanup );

// shell: true is required on Windows because `npx` resolves to npx.cmd.
const child = spawn(
	'npx',
	[
		'-y',
		'@wp-playground/cli@latest',
		'server',
		'--blueprint=' + localBlueprint,
		'--auto-mount',
		'--login',
		'--port=' + port,
	],
	{ stdio: 'inherit', cwd: repoRoot, shell: true }
);
child.on( 'exit', ( code ) => { cleanup(); process.exit( code ?? 0 ); } );
