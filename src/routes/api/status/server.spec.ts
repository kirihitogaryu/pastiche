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

	it('returns library status with extension CORS headers', async () => {
		const { GET } = await import('./+server');

		const response = await GET();

		expect(response.status).toBe(200);
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
		expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, DELETE, OPTIONS');
		expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type');
		await expect(response.json()).resolves.toEqual({
			connected: true,
			unassigned_count: 0,
			recent_folders: [],
			imported_sources: []
		});
	});
});
