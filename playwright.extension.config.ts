import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests',
	testMatch: 'extension.chromium.e2e.ts',
	workers: 1,
	timeout: 60_000,
	fullyParallel: false,
	webServer: {
		command: 'node scripts/pastiche-e2e-server.mjs',
		port: 4173
	}
});
