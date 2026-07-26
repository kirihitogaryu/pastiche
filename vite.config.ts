import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		// Deep icon entry points are discovered as Atlas routes load. Pre-bundling them
		// invalidates the active dependency graph and can strand the browser on stale
		// module hashes, so let the Svelte plugin transform them directly instead.
		exclude: ['phosphor-svelte']
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'extension/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
