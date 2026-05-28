type RuntimeApi = {
	sendMessage(message: unknown): Promise<unknown>;
	onMessage: {
		addListener(
			listener: (
				message: unknown,
				sender: unknown,
				sendResponse: (response?: unknown) => void
			) => boolean | void
		): void;
	};
	openOptionsPage?(): void;
};

type StorageArea = {
	get(keys?: string[] | Record<string, unknown> | string | null): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
};

type ExtensionApi = {
	runtime: RuntimeApi;
	storage: { local: StorageArea };
	sidePanel?: { setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void> };
};

export function getExtensionApi(): ExtensionApi {
	const api =
		(globalThis as typeof globalThis & { browser?: ExtensionApi; chrome?: ExtensionApi }).browser ??
		(globalThis as typeof globalThis & { browser?: ExtensionApi; chrome?: ExtensionApi }).chrome;
	if (!api) throw new Error('Extension API is unavailable.');
	return api as ExtensionApi;
}
