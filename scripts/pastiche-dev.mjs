#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = '5173';

/**
 * @typedef {{ name: string; command: string; args: string[] }} DevCommand
 * @typedef {{ browser?: 'chrome' | 'firefox'; port?: string | number }} DevOptions
 */

/**
 * @param {DevOptions} [options]
 * @returns {DevCommand[]}
 */
export function buildDevCommands({ browser = 'chrome', port = DEFAULT_PORT } = {}) {
	const extensionScript = browser === 'firefox' ? 'build:extension:firefox' : 'build:extension';
	return [
		{
			name: 'server',
			command: 'npm',
			args: ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort']
		},
		{
			name: 'extension',
			command: 'npm',
			args: ['run', extensionScript, '--', '--watch']
		}
	];
}

/**
 * @param {string[]} argv
 * @returns {{ browser: 'chrome' | 'firefox'; port: string }}
 */
export function parseArgs(argv) {
	const browser = argv.includes('--firefox') ? 'firefox' : 'chrome';
	const portArg = argv.find((arg) => arg.startsWith('--port='));
	const port = portArg?.slice('--port='.length) || process.env.PORT || DEFAULT_PORT;
	return { browser, port };
}

/**
 * @param {string} argvPath
 * @param {string} modulePath
 * @param {string} [realArgvPath]
 */
export function isExecutedScript(argvPath, modulePath, realArgvPath = realpathSync(argvPath)) {
	return realArgvPath === modulePath;
}

/** @param {string} modulePath */
export function devWorkingDirectory(modulePath = fileURLToPath(import.meta.url)) {
	return resolve(dirname(modulePath), '..');
}

function run() {
	const options = parseArgs(process.argv.slice(2));
	const commands = buildDevCommands(options);
	const cwd = devWorkingDirectory();
	const extensionPath = options.browser === 'firefox' ? 'extension/dist-firefox' : 'extension/dist';
	const children = new Set();
	let shuttingDown = false;

	console.log('Starting Pastiche local development...');
	console.log(`App:       http://127.0.0.1:${options.port}`);
	console.log(`Extension: ${extensionPath}`);
	console.log('Press Ctrl-C to stop both processes.\n');

	for (const command of commands) {
		const child = spawn(command.command, command.args, {
			cwd,
			env: process.env,
			stdio: ['inherit', 'pipe', 'pipe']
		});
		children.add(child);
		prefixStream(command.name, child.stdout);
		prefixStream(command.name, child.stderr);

		child.on('exit', (code, signal) => {
			children.delete(child);
			if (shuttingDown) return;
			shuttingDown = true;
			const reason = signal ? `signal ${signal}` : `exit code ${code ?? 0}`;
			console.error(`\n${command.name} stopped with ${reason}. Stopping Pastiche dev.`);
			stopChildren(children);
			process.exit(code ?? 1);
		});
	}

	const stop = () => {
		if (shuttingDown) return;
		shuttingDown = true;
		console.log('\nStopping Pastiche dev...');
		stopChildren(children);
	};
	process.on('SIGINT', stop);
	process.on('SIGTERM', stop);
}

/**
 * @param {string} name
 * @param {import('node:stream').Readable} stream
 */
function prefixStream(name, stream) {
	let pending = '';
	/** @param {Buffer | string} chunk */
	stream.on('data', (chunk) => {
		pending += chunk.toString();
		const lines = pending.split(/\r?\n/);
		pending = lines.pop() ?? '';
		for (const line of lines) {
			if (line.length > 0) console.log(`[${name}] ${line}`);
		}
	});
	stream.on('end', () => {
		if (pending.length > 0) console.log(`[${name}] ${pending}`);
	});
}

/** @param {Set<import('node:child_process').ChildProcess>} children */
function stopChildren(children) {
	for (const child of children) {
		if (!child.killed) child.kill('SIGTERM');
	}
	setTimeout(() => process.exit(0), 250);
}

if (process.argv[1] && isExecutedScript(process.argv[1], fileURLToPath(import.meta.url))) {
	run();
}
