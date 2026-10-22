#!/usr/bin/env node
/**
 * Boot WordPress Playground locally with the working tree mounted as the
 * plugin. Strips the blueprint's "install BVM from GitHub" step first so the
 * plugin doesn't load twice (auto-mount handles it).
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const repoRoot = resolve( __dirname, '..' );
const sourceBlueprint = resolve( repoRoot, 'blueprint.json' );
const localBlueprint = resolve( repoRoot, '.blueprint.local.json' );

const original = JSON.parse( readFileSync( sourceBlueprint, 'utf8' ) );
const filtered = {
	...original,
	steps: original.steps.filter(
		( s ) => ! ( s.step === 'installPlugin' && s?.pluginData?.resource === 'git:directory' )
	),
};
writeFileSync( localBlueprint, JSON.stringify( filtered, null, 2 ) );

const cleanup = () => {
	try { unlinkSync( localBlueprint ); } catch ( e ) { /* ignore */ }
};

// COR-12: shell:true is required on Windows (npx resolves to npx.cmd), but
// array args are concatenated UNQUOTED — quote and join ourselves so a
// checkout path with a space survives.
const quote = ( s ) => ( /[\s"]/.test( s ) ? '"' + s.replace( /"/g, '\\"' ) + '"' : s );
const command = [
	'npx',
	'-y',
	// Pinned for determinism (kept in step with scripts/playground-e2e.mjs).
	'@wp-playground/cli@3.1.60',
	'server',
	'--blueprint=' + localBlueprint,
	'--auto-mount',
].map( quote ).join( ' ' );

const child = spawn( command, { stdio: 'inherit', cwd: repoRoot, shell: true } );

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
	process.exit( signal ? 1 : code ?? 0 );
} );
