import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDepartments = vi.fn();
const getDepartmentsArtic = vi.fn();

vi.mock('$lib/explore/connectors', () => ({
	getExploreConnector: (source = 'met') =>
		source === 'artic' ? { getDepartments: getDepartmentsArtic } : { getDepartments },
	isSourceId: (value: string) => value === 'met' || value === 'artic'
}));

describe('GET /explore/api/departments', () => {
	beforeEach(() => {
		getDepartments.mockReset();
		getDepartmentsArtic.mockReset();
		vi.resetModules();
	});

	it('returns Met department labels and ids', async () => {
		getDepartments.mockResolvedValue([{ id: '11', label: 'European Paintings' }]);
		const { GET } = await import('./+server');

		const response = await GET();

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe(
			'public, max-age=86400, stale-while-revalidate=604800'
		);
		await expect(response.json()).resolves.toEqual({
			departments: [{ id: '11', label: 'European Paintings' }]
		});
	});

	it('routes source-aware department requests to the requested connector', async () => {
		getDepartmentsArtic.mockResolvedValue([{ id: 'PC-12', label: 'Painting and Sculpture' }]);
		const { GET } = await import('./+server');

		const response = await GET({
			request: new Request('http://localhost/explore/api/departments?source=artic')
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			departments: [{ id: 'PC-12', label: 'Painting and Sculpture' }]
		});
		expect(getDepartmentsArtic).toHaveBeenCalled();
		expect(getDepartments).not.toHaveBeenCalled();
	});

	it('rejects unsupported department sources', async () => {
		const { GET } = await import('./+server');

		const response = await GET({
			request: new Request('http://localhost/explore/api/departments?source=nope')
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ error: 'Invalid Explore source' });
	});

	it('returns a bad gateway response when the connector cannot load departments', async () => {
		getDepartments.mockRejectedValue(new Error('network timeout'));
		const { GET } = await import('./+server');

		const response = await GET();

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toMatchObject({
			error: 'Explore departments failed to load'
		});
	});
});
