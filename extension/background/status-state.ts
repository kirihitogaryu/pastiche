import type { ConnectionState } from '../shared/types';

export function offlineStatusFromCache(
	lastStatus: ConnectionState | undefined,
	queuedCount: number
): ConnectionState {
	return {
		connected: false,
		offline: true,
		queuedCount,
		unassignedCount: lastStatus?.unassignedCount ?? 0,
		recentFolders: lastStatus?.recentFolders ?? [],
		folders: lastStatus?.folders ?? [],
		importedSources: lastStatus?.importedSources ?? []
	};
}
