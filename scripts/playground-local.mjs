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
process.on( 'SIGINT', () => { cleanup(); process.exit( 0 ); } );
process.on( 'SIGTERM', () => { cleanup(); process.exit( 0 ); } );
process.on( 'exit', cleanup );

// shell: true is required on Windows because `npx` resolves to npx.cmd
// (a batch file), which Node's spawn rejects with EINVAL otherwise. Safe
// on POSIX too — argv contains no user input.
const child = spawn(
	'npx',
	[ '-y', '@wp-playground/cli@latest', 'server', '--blueprint=' + localBlueprint, '--auto-mount' ],
	{ stdio: 'inherit', cwd: repoRoot, shell: true }
);
child.on( 'exit', ( code ) => { cleanup(); process.exit( code ?? 0 ); } );
