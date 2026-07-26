import { expect, test, chromium, type BrowserContext } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const APP_PORT = 4173;
const FIXTURE_PORT = 4174;
const extensionPath = resolve('extension/dist');

type RuntimeChromeApi = {
	storage: {
		local: {
			set(values: Record<string, unknown>): Promise<void>;
			get(key: string): Promise<Record<string, unknown>>;
		};
		session?: {
			get(key: string): Promise<Record<string, unknown>>;
		};
	};
	runtime: { sendMessage<T = unknown>(message: unknown): Promise<T> };
	tabs: {
		query(query: Record<string, unknown>): Promise<Array<{ id?: number }>>;
		sendMessage<T = unknown>(tabId: number, message: unknown): Promise<T>;
	};
	scripting: {
		executeScript(options: { target: { tabId: number }; files: string[] }): Promise<unknown[]>;
	};
};

test('Chromium extension connects, captures an original, and bookmarks only on request', async () => {
	const imageBytes = await sharp({
		create: {
			width: 1200,
			height: 800,
			channels: 4,
			background: { r: 47, g: 94, b: 82, alpha: 1 }
		}
	})
		.png()
		.toBuffer();
	const fixtureServer = await startFixtureServer(imageBytes);
	const profilePath = mkdtempSync(join(tmpdir(), 'pastiche-extension-e2e-'));
	let context: BrowserContext | null = null;

	try {
		context = await chromium.launchPersistentContext(profilePath, {
			headless: true,
			executablePath: chromiumExecutable(),
			args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
		});

		let [worker] = context.serviceWorkers();
		worker ??= await context.waitForEvent('serviceworker');
		const extensionId = new URL(worker.url()).host;
		expect(extensionId).not.toBe('');

		await worker.evaluate(
			async ({ port }) => {
				const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
				await api.storage.local.set({
					pastichePort: port,
					localApiToken: '',
					sizeThreshold: 300,
					defaultDestinationId: null
				});
			},
			{ port: APP_PORT }
		);
		const folderResponse = await fetch(`http://127.0.0.1:${APP_PORT}/api/library/folders`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Extension acceptance' })
		});
		expect(folderResponse.ok).toBe(true);

		const fixturePage = await context.newPage();
		await fixturePage.goto(`http://127.0.0.1:${FIXTURE_PORT}/capture-fixture`);
		await expect(fixturePage.getByRole('img', { name: 'Acceptance original' })).toBeVisible();

		const sidebar = await context.newPage();
		await sidebar.goto(`chrome-extension://${extensionId}/sidebar/index.html`);
		await expect(sidebar.getByText('Connected', { exact: true })).toBeVisible();

		const status = await sidebar.evaluate(async () => {
			const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
			return api.runtime.sendMessage<{
				connected: boolean;
				offline: boolean;
				folders: unknown[];
			}>({ type: 'PASTICHE_GET_STATUS' });
		});
		expect(status).toMatchObject({ connected: true, offline: false });
		expect(status.folders.length).toBeGreaterThan(0);

		const contentPing = await sidebar.evaluate(
			async ({ fixtureUrl }) => {
				const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
				const [tab] = await api.tabs.query({ url: fixtureUrl });
				if (!tab?.id) return { ok: false };
				try {
					return await api.tabs.sendMessage(tab.id, { type: 'PASTICHE_CONTENT_PING' });
				} catch {
					await api.scripting.executeScript({
						target: { tabId: tab.id },
						files: ['content/index.js']
					});
					return api.tabs.sendMessage(tab.id, { type: 'PASTICHE_CONTENT_PING' });
				}
			},
			{ fixtureUrl: fixturePage.url() }
		);
		expect(contentPing).toEqual({ ok: true });

		const sweep = await sidebar.evaluate(
			async ({ fixtureUrl }) => {
				const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
				const [tab] = await api.tabs.query({ url: fixtureUrl });
				if (!tab?.id) return { ok: false, found: 0, delivered: 0 };
				return api.tabs.sendMessage(tab.id, {
					type: 'PASTICHE_SWEEP',
					minDimension: 300
				});
			},
			{ fixtureUrl: fixturePage.url() }
		);
		expect(sweep).toMatchObject({ ok: true, found: 1, delivered: 1 });

		await expect
			.poll(async () => {
				const tray = await sidebar.evaluate(async () => {
					const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
					return api.runtime.sendMessage<{ items: Array<{ fetchStatus: { state: string } }> }>({
						type: 'PASTICHE_GET_CAPTURE_TRAY'
					});
				});
				return tray.items[0]?.fetchStatus.state;
			})
			.toBe('done');

		const captured = await sidebar.evaluate(async () => {
			const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
			const tray = await api.runtime.sendMessage<{ items: unknown[] }>({
				type: 'PASTICHE_GET_CAPTURE_TRAY'
			});
			return tray.items[0];
		});
		expect(captured).toMatchObject({
			storageMode: 'download',
			storageModeReason: 'Original stored locally',
			naturalWidth: 1200,
			naturalHeight: 800,
			fetchStatus: { state: 'done', mimeType: 'image/png' },
			metadata: {
				artist: 'Acceptance Artist',
				artistUsername: 'acceptance_artist',
				artistProfileUrl: `http://127.0.0.1:${FIXTURE_PORT}/acceptance_artist`
			}
		});

		await expect(sidebar.getByText('Original ready', { exact: true })).toBeVisible();
		const artistField = sidebar.locator('.artist-field input');
		await expect(artistField).toBeVisible();
		await expect(artistField).toHaveValue('Acceptance Artist');
		await expect(sidebar.getByLabel('Artist profile URL')).toHaveValue(
			`http://127.0.0.1:${FIXTURE_PORT}/acceptance_artist`
		);
		await expect(sidebar.getByText('Credits near image · high')).toBeVisible();
		await artistField.fill('Unlisted Artist');
		await sidebar.evaluate(async () => {
			const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
			const stored = await api.storage.local.get('pastiche_capture_tray_items');
			const tray = stored.pastiche_capture_tray_items as Array<Record<string, unknown>>;
			await api.storage.local.set({
				pastiche_capture_tray_items: tray.map((item, index) =>
					index === 0 ? { ...item, storageModeReason: 'Background refresh fixture' } : item
				)
			});
		});
		await expect(artistField).toHaveValue('Unlisted Artist');
		await artistField.press('Enter');
		await expect
			.poll(async () => {
				const tray = await sidebar.evaluate(async () => {
					const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
					return api.runtime.sendMessage<{
						items: Array<{ metadata: { artist: string | null } }>;
					}>({ type: 'PASTICHE_GET_CAPTURE_TRAY' });
				});
				return tray.items[0]?.metadata.artist;
			})
			.toBe('Unlisted Artist');

		const tagField = sidebar.getByRole('combobox', { name: 'Tags' });
		await tagField.fill('Black Hair, Crème brûlée, Field Sketch');
		await expect(sidebar.getByText('Will save as field_sketch')).toBeVisible();
		await tagField.press('Enter');
		await expect
			.poll(async () => {
				const tray = await sidebar.evaluate(async () => {
					const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
					return api.runtime.sendMessage<{
						items: Array<{ metadata: { tags: string[] } }>;
					}>({ type: 'PASTICHE_GET_CAPTURE_TRAY' });
				});
				return tray.items[0]?.metadata.tags;
			})
			.toEqual(['black_hair', 'creme_brulee', 'field_sketch']);

		await sidebar.getByRole('button', { name: 'Bookmark instead' }).click();
		await expect(sidebar.getByText('Bookmarked', { exact: true })).toBeVisible();
		await expect
			.poll(async () => {
				const tray = await sidebar.evaluate(async () => {
					const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
					return api.runtime.sendMessage<{ items: Array<{ storageMode: string }> }>({
						type: 'PASTICHE_GET_CAPTURE_TRAY'
					});
				});
				return tray.items[0]?.storageMode;
			})
			.toBe('lazy_download');

		await sidebar.getByRole('button', { name: 'Import original' }).click();
		await expect(sidebar.getByText('Original ready', { exact: true })).toBeVisible();
		await expect(sidebar.getByRole('searchbox', { name: 'Find a folder' })).toBeVisible();

		await fixturePage.bringToFront();
		const droppedFile = await sidebar.evaluateHandle(() => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File(
					[
						'<svg xmlns="http://www.w3.org/2000/svg" width="1216" height="832"><rect width="1216" height="832" fill="#674b8d"/></svg>'
					],
					'novelai-dragon.svg',
					{ type: 'image/svg+xml' }
				)
			);
			return transfer;
		});
		await sidebar.locator('main').dispatchEvent('drop', { dataTransfer: droppedFile });
		await expect
			.poll(async () => {
				const tray = await sidebar.evaluate(async () => {
					const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
					return api.runtime.sendMessage<{
						items: Array<{
							url: string;
							storageMode: string;
							naturalWidth: number;
							naturalHeight: number;
							mimeType: string;
							fetchStatus: { state: string; blobKey?: string };
						}>;
					}>({ type: 'PASTICHE_GET_CAPTURE_TRAY' });
				});
				return tray.items.find((item) => item.url.startsWith('pastiche-drop://'));
			})
			.toMatchObject({
				storageMode: 'download',
				naturalWidth: 1216,
				naturalHeight: 832,
				mimeType: 'image/svg+xml',
				fetchStatus: {
					state: 'done',
					blobKey: expect.stringMatching(/^dropped-image:/)
				}
			});
		await droppedFile.dispose();

		await fixturePage.bringToFront();
		const draggedImageBox = await fixturePage.evaluate(async () => {
			const draggedImage = new Image();
			draggedImage.src = '/drag-original.png';
			draggedImage.alt = 'Drag handoff';
			draggedImage.draggable = true;
			draggedImage.style.display = 'block';
			document.body.append(draggedImage);
			await draggedImage.decode();
			draggedImage.scrollIntoView({ block: 'center' });
			const rect = draggedImage.getBoundingClientRect();
			return {
				x: rect.left,
				y: rect.top,
				width: rect.width,
				height: rect.height
			};
		});
		const dragStartX = Math.max(16, draggedImageBox.x + Math.min(48, draggedImageBox.width / 2));
		const dragStartY = Math.max(16, draggedImageBox.y + Math.min(96, draggedImageBox.height / 2));
		await fixturePage.mouse.move(dragStartX, dragStartY);
		await fixturePage.mouse.down();
		await fixturePage.mouse.move(dragStartX + 120, dragStartY + 48, { steps: 12 });

		await expect
			.poll(async () =>
				fixturePage.evaluate(() =>
					Boolean(document.getElementById('__pastiche_drag_capture_panel__'))
				)
			)
			.toBe(true);
		await fixturePage.mouse.up();

		await fixturePage.evaluate(() => {
			const host = document.getElementById('__pastiche_drag_capture_panel__');
			if (!host) throw new Error('Page-local capture panel was not available.');
			const dataTransfer = new DataTransfer();
			host.dispatchEvent(
				new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer })
			);
			host.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
		});
		await expect
			.poll(async () => {
				const tray = await sidebar.evaluate(async () => {
					const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
					return api.runtime.sendMessage<{
						items: Array<{ url: string; fetchStatus: { state: string } }>;
					}>({ type: 'PASTICHE_GET_CAPTURE_TRAY' });
				});
				return tray.items.find((item) => item.url.includes('/drag-original.png')) ?? null;
			})
			.toMatchObject({ fetchStatus: { state: 'done' } });

		// A failed fetch can complete after the user removes it. The background
		// mutation queue must keep that late completion from resurrecting the item,
		// and ready captures must remain importable while another item is failing.
		const stagedFailure = await sidebar.evaluate(
			async ({ imageUrl, sourceUrl }) => {
				const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
				return api.runtime.sendMessage<{ ok: boolean }>({
					type: 'PASTICHE_ITEM_CAPTURED',
					item: {
						url: imageUrl,
						detailUrl: null,
						naturalWidth: 1200,
						naturalHeight: 1100,
						mimeType: null,
						inlineData: null,
						altText: 'Toyhouse failure fixture',
						sourceUrl,
						pageTitle: 'Toyhouse failure fixture',
						capturedAt: new Date().toISOString()
					}
				});
			},
			{
				imageUrl: `http://127.0.0.1:${FIXTURE_PORT}/slow-not-image`,
				sourceUrl: `http://127.0.0.1:${FIXTURE_PORT}/toyhouse-fixture`
			}
		);
		expect(stagedFailure).toEqual({ ok: true });

		const removeFailure = sidebar.getByRole('button', {
			name: 'Remove slow not image'
		});
		await expect(removeFailure).toBeVisible();
		await expect(sidebar.getByRole('button', { name: /^Import \d+ images?$/ })).toBeEnabled();
		await removeFailure.click();
		await expect(removeFailure).toBeHidden();

		await expect
			.poll(
				async () => {
					const tray = await sidebar.evaluate(async () => {
						const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
						return api.runtime.sendMessage<{
							items: Array<{ url: string }>;
						}>({ type: 'PASTICHE_GET_CAPTURE_TRAY' });
					});
					return tray.items.some((item) => item.url.includes('/slow-not-image'));
				},
				{ timeout: 3_000 }
			)
			.toBe(false);

		// A stale green status must not strand the button if the local app goes
		// away between status checks. The worker preflight queues promptly and
		// the sidebar always returns to a terminal state.
		await sidebar.evaluate(async () => {
			const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
			await api.storage.local.set({ pastichePort: 49_999 });
		});
		const importButton = sidebar.getByRole('button', { name: 'Import 3 images' });
		await expect(importButton).toBeEnabled();
		await importButton.click();
		await expect(sidebar.getByText('Import queued', { exact: true })).toBeVisible({
			timeout: 5_000
		});
		await expect(importButton).toBeHidden();

		await sidebar.evaluate(
			async ({ port }) => {
				const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
				await api.storage.local.set({ pastichePort: port });
				await api.runtime.sendMessage({ type: 'PASTICHE_GET_STATUS' });
			},
			{ port: APP_PORT }
		);
		await expect
			.poll(
				async () => {
					return sidebar.evaluate(async () => {
						const api = (globalThis as typeof globalThis & { chrome: RuntimeChromeApi }).chrome;
						const status = await api.runtime.sendMessage<{ queuedCount: number }>({
							type: 'PASTICHE_GET_STATUS'
						});
						const tray = await api.runtime.sendMessage<{ items: unknown[] }>({
							type: 'PASTICHE_GET_CAPTURE_TRAY'
						});
						return { queuedCount: status.queuedCount, trayCount: tray.items.length };
					});
				},
				{ timeout: 10_000 }
			)
			.toEqual({ queuedCount: 0, trayCount: 0 });
	} finally {
		await context?.close();
		await closeServer(fixtureServer);
		rmSync(profilePath, { recursive: true, force: true });
	}
});

function chromiumExecutable() {
	const configured = process.env.PASTICHE_CHROMIUM_EXECUTABLE;
	if (configured && existsSync(configured)) return configured;
	if (existsSync('/usr/bin/chromium')) return '/usr/bin/chromium';
	return undefined;
}

async function startFixtureServer(imageBytes: Buffer): Promise<Server> {
	const server = createServer((request, response) => {
		if (request.url === '/original.png' || request.url === '/drag-original.png') {
			response.writeHead(200, {
				'content-type': request.url === '/drag-original.png' ? 'PNG32' : 'image/png',
				'content-length': imageBytes.length,
				'cache-control': 'no-store'
			});
			response.end(imageBytes);
			return;
		}

		if (request.url === '/slow-not-image') {
			setTimeout(() => {
				response.writeHead(200, {
					'content-type': 'text/html; charset=utf-8',
					'cache-control': 'no-store'
				});
				response.end('<!doctype html><title>Not an image</title>');
			}, 750);
			return;
		}

		response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
		response.end(`<!doctype html>
			<html lang="en">
				<head><title>Extension acceptance fixture</title></head>
				<body>
					<article>
						<div class="image-stage"><img src="/original.png" alt="Acceptance original"></div>
						<footer class="credits">
							<strong>Credits</strong>
							<a href="/acceptance_artist">Acceptance Artist</a>
						</footer>
					</article>
				</body>
			</html>`);
	});

	await new Promise<void>((resolvePromise, reject) => {
		server.once('error', reject);
		server.listen(FIXTURE_PORT, '127.0.0.1', () => resolvePromise());
	});
	return server;
}

function closeServer(server: Server) {
	return new Promise<void>((resolvePromise, reject) => {
		server.close((error) => (error ? reject(error) : resolvePromise()));
	});
}
