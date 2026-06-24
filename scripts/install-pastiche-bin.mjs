#!/usr/bin/env node

import { lstat, mkdir, readlink, symlink, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), '..');
const target = join(repoRoot, 'scripts', 'pastiche-dev.mjs');
const binDir = join(homedir(), '.local', 'bin');
const linkPath = join(binDir, 'pastiche');

await mkdir(binDir, { recursive: true });

try {
	const existing = await lstat(linkPath);
	if (existing.isSymbolicLink()) {
		const currentTarget = await readlink(linkPath);
		if (resolve(binDir, currentTarget) !== target) await unlink(linkPath);
	} else {
		throw new Error(`${linkPath} already exists and is not a symlink.`);
	}
} catch (error) {
	if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}

try {
	await symlink(target, linkPath);
} catch (error) {
	if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
}

console.log(`Installed ${linkPath} -> ${target}`);
console.log('Run `pastiche` from any terminal to start the app server and extension watcher.');
