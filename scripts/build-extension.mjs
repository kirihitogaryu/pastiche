import { build } from 'vite';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const browserArg = process.argv.find((value) => value.startsWith('--browser='));
const browser = browserArg?.slice('--browser='.length) || 'chrome';
const watch = process.argv.includes('--watch');

if (browser !== 'chrome' && browser !== 'firefox') {
	throw new Error(`Unsupported extension browser target: ${browser}`);
}

process.env.BROWSER = browser;

for (const configName of ['vite.config.ts', 'vite.content.config.ts']) {
	await build({
		configFile: resolve(workspaceRoot, 'extension', configName),
		build: watch ? { watch: {} } : undefined
	});
}

if (!watch) verifyClassicContentScript();

async function verifyClassicContentScript() {
	const { readFile } = await import('node:fs/promises');
	const outDir = browser === 'firefox' ? 'dist-firefox' : 'dist';
	const contentPath = resolve(workspaceRoot, 'extension', outDir, 'content/index.js');
	const source = await readFile(contentPath, 'utf8');
	if (/^\s*(?:import|export)\b/m.test(source)) {
		throw new Error(`${contentPath} is not a classic self-contained content script.`);
	}
}
