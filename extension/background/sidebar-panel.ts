type SidebarApi = {
	sidePanel?: {
		open?(options?: { windowId?: number }): Promise<void>;
	};
	sidebarAction?: {
		open(): Promise<void>;
	};
};

type MessageSenderLike = {
	tab?: {
		windowId?: number;
	};
};

export async function openExtensionSidebar(
	api: SidebarApi,
	sender?: MessageSenderLike
): Promise<void> {
	const windowId = sender?.tab?.windowId;
	try {
		if (api.sidePanel?.open) {
			await api.sidePanel.open(typeof windowId === 'number' ? { windowId } : undefined);
			return;
		}
		await api.sidebarAction?.open?.();
	} catch {
		// Browser support and user-gesture handling differ here. Drag/drop still works
		// when the sidebar is already open.
	}
}
