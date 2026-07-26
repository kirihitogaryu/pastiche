import { DEFAULT_DESTINATION_ID, DEFAULT_PASTICHE_PORT, DEFAULT_SIZE_THRESHOLD } from './constants';
import { getExtensionApi } from './browser';
import type { ExtensionSettings } from './types';

export const DEFAULT_SETTINGS: ExtensionSettings = {
	pastichePort: DEFAULT_PASTICHE_PORT,
	localApiToken: '',
	sizeThreshold: DEFAULT_SIZE_THRESHOLD,
	dragCaptureEnabled: true,
	defaultDestinationId: DEFAULT_DESTINATION_ID
};

export function normalizeSettings(value: Partial<ExtensionSettings> = {}): ExtensionSettings {
	return {
		pastichePort: validPort(value.pastichePort)
			? value.pastichePort
			: DEFAULT_SETTINGS.pastichePort,
		localApiToken: typeof value.localApiToken === 'string' ? value.localApiToken.trim() : '',
		sizeThreshold:
			typeof value.sizeThreshold === 'number' && value.sizeThreshold > 0
				? Math.round(value.sizeThreshold)
				: DEFAULT_SETTINGS.sizeThreshold,
		dragCaptureEnabled:
			typeof value.dragCaptureEnabled === 'boolean'
				? value.dragCaptureEnabled
				: DEFAULT_SETTINGS.dragCaptureEnabled,
		defaultDestinationId:
			value.defaultDestinationId === null || typeof value.defaultDestinationId === 'string'
				? value.defaultDestinationId
				: DEFAULT_SETTINGS.defaultDestinationId
	};
}

export function localApiHeaders(settings: ExtensionSettings): Record<string, string> {
	return settings.localApiToken ? { 'x-pastiche-local-client': settings.localApiToken } : {};
}

export async function getSettings(): Promise<ExtensionSettings> {
	const api = getExtensionApi();
	const stored = await api.storage.local.get(DEFAULT_SETTINGS);
	return normalizeSettings(stored as Partial<ExtensionSettings>);
}

export async function saveSettings(settings: ExtensionSettings) {
	const api = getExtensionApi();
	await api.storage.local.set(normalizeSettings(settings));
}

function validPort(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0 && value < 65536;
}
