import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = resolve(__dirname);
const browserName = process.env.BROWSER ?? 'chrome';
if (browserName !== 'chrome' && browserName !== 'firefox') {
	throw new Error(`Unsupported extension browser target: ${browserName}`);
}

const outDir = browserName === 'firefox' ? 'dist-firefox' : 'dist';

/**
 * Content scripts are loaded as classic scripts by both Chromium and Firefox.
 * Build this entry separately so Rollup can inline every dependency into one
 * IIFE instead of sharing ESM chunks with the sidebar or service worker.
 */
export default defineConfig({
	root,
	build: {
		emptyOutDir: false,
		outDir,
		rollupOptions: {
			input: resolve(root, 'content/index.ts'),
			output: {
				entryFileNames: 'content/index.js',
				format: 'iife'
			}
		}
	}
});
