import { resolve } from 'node:path';
import fs from 'node:fs';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const root = resolve(__dirname);

// ---------------------------------------------------------------------------
// Browser target — set via BROWSER env var at build time.
// Defaults to 'chrome'. Set to 'firefox' for the Firefox build.
//
//   BROWSER=chrome  npm run build:extension   (or just npm run build:extension)
//   BROWSER=firefox npm run build:extension:firefox
//
// The only difference between targets right now is which manifest gets copied
// into dist/. The compiled JS is identical — the shim in shared/browser.ts
// and the inline shim in content/index.ts handle runtime differences.
// ---------------------------------------------------------------------------

const browserName = process.env.BROWSER ?? 'chrome';
if (browserName !== 'chrome' && browserName !== 'firefox') {
	throw new Error(`Unsupported extension browser target: ${browserName}`);
}

const browser = browserName;
const outDir = browser === 'firefox' ? 'dist-firefox' : 'dist';

export default defineConfig({
	root,
	plugins: [
		svelte(),
		// Copy the correct manifest into the output directory after build.
		{
			name: 'copy-manifest',
			closeBundle() {
				const src = resolve(root, `manifest.${browser}.json`);
				const dest = resolve(root, outDir, 'manifest.json');
				fs.copyFileSync(src, dest);
				console.log(`[copy-manifest] Copied manifest.${browser}.json → ${outDir}/manifest.json`);
			}
		}
	],
	build: {
		emptyOutDir: true,
		outDir,
		rollupOptions: {
			input: {
				'sidebar/index': resolve(root, 'sidebar/index.html'),
				'settings/index': resolve(root, 'settings/index.html'),
				'background/service-worker': resolve(root, 'background/service-worker.ts'),
				'content/index': resolve(root, 'content/index.ts')
			},
			output: {
				entryFileNames: '[name].js',
				chunkFileNames: 'shared/[name]-[hash].js',
				assetFileNames: 'assets/[name]-[hash][extname]'
			}
		}
	}
});
