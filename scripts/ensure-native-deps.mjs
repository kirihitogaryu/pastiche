#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import {
	devWorkingDirectory,
	ensureNativeDependencies,
	isExecutedScript
} from './pastiche-dev.mjs';

export async function runEnsureNativeDeps() {
	await ensureNativeDependencies(devWorkingDirectory(fileURLToPath(import.meta.url)));
}

if (process.argv[1] && isExecutedScript(process.argv[1], fileURLToPath(import.meta.url))) {
	runEnsureNativeDeps().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
