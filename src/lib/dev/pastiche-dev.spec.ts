import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	buildDevCommands,
	childEnvForCurrentNode,
	devWorkingDirectory,
	ensureNativeDependencies,
	isExecutedScript,
	needsNativeDependencyRebuild
} from '../../../scripts/pastiche-dev.mjs';

describe('pastiche dev command', () => {
	it('starts the app server on the extension default port and watches the Chrome extension', () => {
		expect.assertions(1);

		expect(buildDevCommands({ browser: 'chrome' })).toEqual([
			{
				name: 'server',
				command: 'npm',
				args: ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort']
			},
			{
				name: 'extension',
				command: 'npm',
				args: ['run', 'build:extension', '--', '--watch']
			}
		]);
	});

	it('can target the Firefox extension watcher when requested', () => {
		expect.assertions(1);

		expect(buildDevCommands({ browser: 'firefox' })[1]).toEqual({
			name: 'extension',
			command: 'npm',
			args: ['run', 'build:extension:firefox', '--', '--watch']
		});
	});

	it('treats a symlinked bin path as the executed script', () => {
		expect.assertions(1);

		expect(
			isExecutedScript(
				'/tmp/bin/pastiche',
				'/repo/scripts/pastiche-dev.mjs',
				'/repo/scripts/pastiche-dev.mjs'
			)
		).toBe(true);
	});

	it('uses the repository root as the child process working directory', () => {
		expect.assertions(1);

		expect(devWorkingDirectory('/home/kristoph/Desktop/pastiche/scripts/pastiche-dev.mjs')).toBe(
			'/home/kristoph/Desktop/pastiche'
		);
	});

	it('rebuilds native SQLite bindings once when the active Node ABI changes', async () => {
		expect.assertions(3);
		const attempts: string[] = [];

		await ensureNativeDependencies('/repo', {
			checkBetterSqlite: async (cwd) => {
				attempts.push(`check:${cwd}`);
				if (attempts.length === 1) {
					throw new Error(
						'The module better_sqlite3.node was compiled using NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 147.'
					);
				}
			},
			rebuildBetterSqlite: async (cwd) => {
				attempts.push(`rebuild:${cwd}`);
			},
			log: () => undefined
		});

		expect(needsNativeDependencyRebuild(new Error('Module did not self-register'))).toBe(true);
		expect(needsNativeDependencyRebuild(new Error('Different failure'))).toBe(false);
		expect(attempts).toEqual(['check:/repo', 'rebuild:/repo', 'check:/repo']);
	});

	it('puts the launcher Node directory first for child npm commands', () => {
		expect.assertions(1);

		expect(childEnvForCurrentNode('/usr/bin/node', { PATH: '/opt/codex/bin:/usr/bin' }).PATH).toBe(
			'/usr/bin:/opt/codex/bin:/usr/bin'
		);
	});

	it('runs the native dependency guard before direct dev and unit test commands', () => {
		expect.assertions(2);
		const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
			scripts: Record<string, string>;
		};

		expect(packageJson.scripts.dev).toMatch(/^node scripts\/ensure-native-deps\.mjs && /);
		expect(packageJson.scripts['test:unit']).toMatch(/^node scripts\/ensure-native-deps\.mjs && /);
	});
});
