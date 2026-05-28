import { DEFAULT_DESTINATION_ID, DEFAULT_PASTICHE_PORT, DEFAULT_SIZE_THRESHOLD } from './constants';
import { getExtensionApi } from './browser';
import type { ExtensionSettings } from './types';

export const DEFAULT_SETTINGS: ExtensionSettings = {
	pastichePort: DEFAULT_PASTICHE_PORT,
	sizeThreshold: DEFAULT_SIZE_THRESHOLD,
	defaultDestinationId: DEFAULT_DESTINATION_ID
};

export function normalizeSettings(value: Partial<ExtensionSettings> = {}): ExtensionSettings {
	return {
		pastichePort: validPort(value.pastichePort)
			? value.pastichePort
			: DEFAULT_SETTINGS.pastichePort,
		sizeThreshold:
			typeof value.sizeThreshold === 'number' && value.sizeThreshold > 0
				? Math.round(value.sizeThreshold)
				: DEFAULT_SETTINGS.sizeThreshold,
		defaultDestinationId:
			value.defaultDestinationId === null || typeof value.defaultDestinationId === 'string'
				? value.defaultDestinationId
				: DEFAULT_SETTINGS.defaultDestinationId
	};
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
