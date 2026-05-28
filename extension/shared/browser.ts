/**
 * shared/browser.ts
 *
 * Thin compatibility shim that returns the extension API regardless of
 * whether we're running in Chrome (chrome.*) or Firefox (browser.*).
 *
 * Only the methods actually used across the codebase are typed here.
 * Add to the interfaces as new capabilities are needed — do not import
 * chrome.* or browser.* directly anywhere else.
 *
 * REPLACES: the original shared/browser.ts (which was missing the tabs API).
 */

// ---------------------------------------------------------------------------
// Sub-API types
// ---------------------------------------------------------------------------

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
		removeListener(
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

/**
 * Typed subset of the tabs API.
 * chrome.tabs.query + tabs.sendMessage cover everything App.svelte needs.
 *
 * Note: chrome.tabs.query with { active, currentWindow } requires the "tabs"
 * permission in manifest.json — make sure it's present.
 */
type TabInfo = {
	id?: number;
	url?: string;
	title?: string;
};

type TabsApi = {
	/**
	 * Query open tabs. Most call sites only use { active: true, currentWindow: true }.
	 */
	query(queryInfo: {
		active?: boolean;
		currentWindow?: boolean;
		url?: string | string[];
	}): Promise<TabInfo[]>;

	/**
	 * Send a one-way message to a content script in a specific tab.
	 * Resolves with the content script's sendResponse value.
	 */
	sendMessage(tabId: number, message: unknown): Promise<unknown>;
};

type CommandsApi = {
	onCommand: {
		addListener(listener: (command: string) => void): void;
	};
};

type ScriptingApi = {
	executeScript(options: { target: { tabId: number }; files: string[] }): Promise<unknown[]>;
};

type ExtensionApi = {
	runtime: RuntimeApi;
	storage: { local: StorageArea };
	tabs: TabsApi;
	commands: CommandsApi;
	scripting?: ScriptingApi;
	sidePanel?: {
		setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
	};
};

// ---------------------------------------------------------------------------
// Shim
// ---------------------------------------------------------------------------

export function getExtensionApi(): ExtensionApi {
	const api =
		(globalThis as typeof globalThis & { browser?: ExtensionApi; chrome?: ExtensionApi }).browser ??
		(globalThis as typeof globalThis & { browser?: ExtensionApi; chrome?: ExtensionApi }).chrome;
	if (!api) throw new Error('Extension API is unavailable.');
	return api as ExtensionApi;
}
