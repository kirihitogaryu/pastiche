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

	it('keeps Firefox localhost HTTP available and declares captured page data honestly', () => {
		const manifest = JSON.parse(
			readFileSync(join('extension', 'manifest.firefox.json'), 'utf8')
		) as {
			content_security_policy?: { extension_pages?: string };
			browser_specific_settings?: {
				gecko?: {
					strict_min_version?: string;
					data_collection_permissions?: { required?: string[] };
				};
			};
		};

		expect(manifest.content_security_policy?.extension_pages).not.toContain(
			'upgrade-insecure-requests'
		);
		expect(manifest.browser_specific_settings?.gecko?.strict_min_version).toBe('142.0');
		expect(
			manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required
		).toEqual(['browsingActivity', 'websiteContent']);
	});

	it.each(manifestFiles)('%s exposes only the page-local capture panel', (filename) => {
		const manifest = JSON.parse(readFileSync(join('extension', filename), 'utf8')) as {
			permissions?: string[];
			side_panel?: unknown;
			sidebar_action?: unknown;
		};

		expect(manifest.permissions ?? []).not.toContain('sidePanel');
		expect(manifest.side_panel).toBeUndefined();
		expect(manifest.sidebar_action).toBeUndefined();
	});
});
