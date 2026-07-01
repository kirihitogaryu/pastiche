import { describe, expect, it, vi } from 'vitest';

import { openExtensionSidebar } from './sidebar-panel';

describe('extension sidebar opening', () => {
	it('opens Chrome sidePanel with the sender window id', async () => {
		const open = vi.fn().mockResolvedValue(undefined);

		await openExtensionSidebar(
			{ sidePanel: { open } },
			{ tab: { windowId: 7 } }
		);

		expect(open).toHaveBeenCalledWith({ windowId: 7 });
	});

	it('falls back to Firefox sidebarAction.open', async () => {
		const open = vi.fn().mockResolvedValue(undefined);

		await openExtensionSidebar({ sidebarAction: { open } }, { tab: { windowId: 7 } });

		expect(open).toHaveBeenCalledOnce();
	});
});
