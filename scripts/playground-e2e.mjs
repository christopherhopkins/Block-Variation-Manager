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
	// QUA-6: the committed visual baselines depend on the rendering
	// environment — pin WordPress for the E2E server instead of "latest"
	// (the public demo blueprint keeps latest; this override is test-only).
	// Keep this on the major.minor the baselines were generated against, and
	// within Playground's supported range: an out-of-range version hangs the
	// boot at "WordPress is not ready yet".
	preferredVersions: {
		...original.preferredVersions,
		wp: '7.1',
	},
	steps: original.steps.filter(
		( s ) => ! ( s.step === 'installPlugin' && s?.pluginData?.resource === 'git:directory' )
	),
};
writeFileSync( localBlueprint, JSON.stringify( filtered, null, 2 ) );

const cleanup = () => {
	try { unlinkSync( localBlueprint ); } catch ( e ) { /* ignore */ }
};

// COR-12: shell:true is required on Windows (npx resolves to npx.cmd), but
// args passed as an array are concatenated UNQUOTED — a checkout path with a
// space breaks --blueprint. Build one properly quoted command string instead.
const quote = ( s ) => ( /[\s"]/.test( s ) ? '"' + s.replace( /"/g, '\\"' ) + '"' : s );
const command = [
	'npx',
	'-y',
	// QUA-6/SEC-7: pinned — an unpinned @latest made baselines and CI
	// non-deterministic (and is a supply-chain exposure in CI).
	'@wp-playground/cli@3.1.60',
	'server',
	'--blueprint=' + localBlueprint,
	'--auto-mount',
	'--login',
	'--port=' + port,
].map( quote ).join( ' ' );

const child = spawn( command, { stdio: 'inherit', cwd: repoRoot, shell: true } );

// COR-12: forward signals so the npx tree dies with us instead of orphaning
// and squatting on the port.
const forward = ( signal ) => () => {
	child.kill( signal );
	cleanup();
	process.exit( 0 );
};
process.on( 'SIGINT', forward( 'SIGINT' ) );
process.on( 'SIGTERM', forward( 'SIGTERM' ) );
process.on( 'exit', cleanup );

child.on( 'exit', ( code, signal ) => {
	cleanup();
	// A signal death is a failure, not success (COR-12).
	process.exit( signal ? 1 : code ?? 0 );
} );
