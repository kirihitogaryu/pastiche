#!/usr/bin/env node

import { mkdirSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const testResultsRoot = resolve(workspaceRoot, 'test-results');
const archiveRoot = resolve(testResultsRoot, 'e2e-library');

if (dirname(archiveRoot) !== testResultsRoot) {
	throw new Error('Refusing to prepare an E2E archive outside test-results.');
}

rmSync(archiveRoot, { recursive: true, force: true });
mkdirSync(archiveRoot, { recursive: true });

const env = {
	...process.env,
	PASTICHE_LIBRARY_DIR: archiveRoot,
	PASTICHE_MOCK_LIBRARY_FALLBACK: '1'
};
const build = spawnSync('npm', ['run', 'build'], {
	cwd: workspaceRoot,
	env,
	stdio: 'inherit'
});
if (build.status !== 0) process.exit(build.status ?? 1);

const preview = spawn(
	'npm',
	['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
	{ cwd: workspaceRoot, env, stdio: 'inherit' }
);

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => preview.kill(signal));
}
preview.on('exit', (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	else process.exit(code ?? 1);
});
