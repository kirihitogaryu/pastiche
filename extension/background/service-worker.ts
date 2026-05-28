import { getSettings } from '../shared/settings';
import type { ConnectionState, ExtensionMessage, SmokeImportResponse } from '../shared/types';
import { getExtensionApi } from '../shared/browser';
import { MESSAGE_GET_STATUS, MESSAGE_SMOKE_IMPORT } from '../shared/messages';

const api = getExtensionApi();

api.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
	// Firefox and older Chromium builds may not support this yet.
});

api.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
	void handleMessage(message as ExtensionMessage).then(sendResponse);
	return true;
});

async function handleMessage(message: ExtensionMessage) {
	if (message.type === MESSAGE_GET_STATUS) return getPasticheStatus();
	if (message.type === MESSAGE_SMOKE_IMPORT) return smokeImport();
	return { ok: false, error: 'Unknown message' };
}

async function getPasticheStatus(): Promise<ConnectionState> {
	const settings = await getSettings();
	try {
		const response = await fetch(`http://localhost:${settings.pastichePort}/api/status`, {
			signal: AbortSignal.timeout(2000)
		});
		if (!response.ok) throw new Error('Pastiche is offline.');
		const status = (await response.json()) as {
			unassigned_count: number;
			recent_folders: ConnectionState['recentFolders'];
		};
		const state: ConnectionState = {
			connected: true,
			offline: false,
			queuedCount: 0,
			unassignedCount: status.unassigned_count,
			recentFolders: status.recent_folders
		};
		await api.storage.local.set({ lastStatus: state });
		return state;
	} catch {
		const cached = await api.storage.local.get(['lastStatus']);
		const lastStatus = cached.lastStatus as ConnectionState | undefined;
		return (
			lastStatus ?? {
				connected: false,
				offline: true,
				queuedCount: 0,
				unassignedCount: 0,
				recentFolders: []
			}
		);
	}
}

async function smokeImport(): Promise<SmokeImportResponse> {
	const settings = await getSettings();
	const response = await fetch(`http://localhost:${settings.pastichePort}/api/import`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			destination_folder_id: null,
			items: [
				{
					filename: 'Pastiche extension smoke test',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/pastiche-extension-smoke.jpg',
					mime_type: 'image/jpeg',
					natural_width: 800,
					natural_height: 600,
					source_url: 'https://example.com/pastiche-extension-smoke',
					page_title: 'Pastiche extension smoke test',
					alt_text: null,
					captured_at: new Date().toISOString()
				}
			]
		})
	});
	if (!response.ok) return { ok: false, error: 'Import failed' };
	return { ok: true };
}
