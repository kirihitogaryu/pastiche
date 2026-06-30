import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const manifestFiles = ['manifest.chrome.json', 'manifest.firefox.json'];

describe('extension manifests', () => {
	it.each(manifestFiles)('%s uses browser-compatible host permission patterns', (filename) => {
		const manifest = JSON.parse(readFileSync(join('extension', filename), 'utf8')) as {
			host_permissions?: string[];
		};

		expect(manifest.host_permissions).toContain('<all_urls>');
		expect(manifest.host_permissions ?? []).not.toContain('http://localhost:*/*');
		expect(manifest.host_permissions ?? []).not.toContain('http://127.0.0.1:*/*');
	});
});
