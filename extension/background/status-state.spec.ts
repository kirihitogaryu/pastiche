import { describe, expect, it } from 'vitest';
import type { ConnectionState } from '../shared/types';
import { offlineStatusFromCache } from './status-state';

describe('extension connection status state', () => {
	it('does not preserve a stale connected flag when status checks fail', () => {
		expect.assertions(1);
		const cached: ConnectionState = {
			connected: true,
			offline: false,
			queuedCount: 0,
			unassignedCount: 7,
			recentFolders: [{ id: 'folder-1', name: 'Inbox', last_used: '2026-07-06T12:00:00.000Z' }],
			folders: [{ id: 'folder-1', name: 'Inbox', parent_id: null, path: 'library/inbox' }],
			importedSources: [
				{
					source_hash: 'hash-1',
					source_image_url: 'https://cdn.example.com/work.jpg',
					source_url: 'https://example.com/post/1'
				}
			]
		};

		expect(offlineStatusFromCache(cached, 3)).toEqual({
			...cached,
			connected: false,
			offline: true,
			queuedCount: 3
		});
	});

	it('returns a cold offline status when there is no cache', () => {
		expect.assertions(1);

		expect(offlineStatusFromCache(undefined, 2)).toEqual({
			connected: false,
			offline: true,
			queuedCount: 2,
			unassignedCount: 0,
			recentFolders: [],
			folders: [],
			importedSources: []
		});
	});
});
