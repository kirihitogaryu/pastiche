import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command:
			'PASTICHE_MOCK_LIBRARY_FALLBACK=1 npm run build && PASTICHE_MOCK_LIBRARY_FALLBACK=1 npm run preview',
		port: 4173
	},
	testMatch: '**/*.e2e.{ts,js}'
});
