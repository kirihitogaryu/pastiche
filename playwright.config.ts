import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'node scripts/pastiche-e2e-server.mjs',
		port: 4173
	},
	testMatch: '**/pastiche.e2e.{ts,js}'
});
