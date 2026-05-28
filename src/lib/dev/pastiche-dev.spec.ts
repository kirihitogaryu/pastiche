import { describe, expect, it } from 'vitest';
import { buildDevCommands, isExecutedScript } from '../../../scripts/pastiche-dev.mjs';

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
});
