import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /api/status', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-status-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('returns library status without wildcard CORS headers for same-origin calls', async () => {
		const { GET } = await import('./+server');

		const response = await GET();

		expect(response.status).toBe(200);
		expect(response.headers.get('access-control-allow-origin')).toBeNull();
		await expect(response.json()).resolves.toEqual({
			connected: true,
			status_cursor: expect.any(String),
			unassigned_count: 0,
			recent_folders: [],
			folders: [],
			imported_sources: []
		});
	});

	it('returns library status with trusted extension CORS headers', async () => {
		const { GET } = await import('./+server');

		const response = await GET({
			request: new Request('http://localhost/api/status', {
				headers: { origin: 'chrome-extension://pastiche-test' }
			})
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('access-control-allow-origin')).toBe(
			'chrome-extension://pastiche-test'
		);
		expect(response.headers.get('access-control-allow-methods')).toBe(
			'GET, POST, PATCH, DELETE, OPTIONS'
		);
		expect(response.headers.get('access-control-allow-headers')).toBe(
			'Content-Type, X-Pastiche-Local-Client'
		);
	});
});
