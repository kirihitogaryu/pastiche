import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const root = resolve(__dirname);

export default defineConfig({
	root,
	plugins: [svelte()],
	build: {
		emptyOutDir: true,
		outDir: 'dist',
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
