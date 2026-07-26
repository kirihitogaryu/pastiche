#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import sharp from 'sharp';
import webext from 'web-ext';

const APP_PORT = 4173;
const FIXTURE_PORT = 4174;
const workspaceRoot = resolve(import.meta.dirname, '..');
const sourceDir = resolve(workspaceRoot, 'extension/dist-firefox');
const firefoxBinary = process.env.PASTICHE_FIREFOX_EXECUTABLE || '/usr/bin/firefox';
const fixtureUrl = `http://127.0.0.1:${FIXTURE_PORT}/capture-fixture`;
let browserCallSequence = 0;

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

const appServer = await startServer(APP_PORT, handleAppRequest);
const fixtureServer = await startServer(FIXTURE_PORT, handleFixtureRequest);
let runner;

try {
	runner = await webext.cmd.run({
		artifactsDir: resolve(workspaceRoot, 'web-ext-artifacts'),
		firefox: firefoxBinary,
		noInput: true,
		noReload: true,
		sourceDir,
		startUrl: [fixtureUrl, 'about:blank'],
		target: ['firefox-desktop'],
		args: ['-headless']
	});

	const firefoxRunner = runner.extensionRunners?.[0];
	assert(firefoxRunner?.remoteFirefox?.client, 'Firefox RDP client was not available.');
	const client = firefoxRunner.remoteFirefox.client;
	installEvaluationRouter(client);

	const addon = await firefoxRunner.remoteFirefox.getInstalledAddon('pastiche-capture@pastiche');
	assert.equal(addon.backgroundScriptStatus, 'RUNNING');
	assert.equal(addon.temporarilyInstalled, true);

	const tabs = await poll(async () => {
		const listed = await client.request('listTabs');
		const fixture = listed.tabs.find((tab) => tab.url === fixtureUrl);
		const blank = listed.tabs.find((tab) => tab.url === 'about:blank');
		return fixture && blank ? { fixture, blank } : null;
	}, 'Firefox did not open the fixture and sidebar host tabs.');

	const sidebarLocation = new URL('sidebar/index.html', addon.manifestURL);
	sidebarLocation.searchParams.set('embedded', '1');
	sidebarLocation.searchParams.set('sourceUrl', fixtureUrl);
	const sidebarUrl = sidebarLocation.href;
	await client.request({
		to: tabs.blank.actor,
		type: 'navigateTo',
		url: sidebarUrl,
		waitForLoad: true
	});

	const sidebar = tabs.blank.actor;
	await browserCall(
		client,
		sidebar,
		`
		await browser.storage.local.set({
			pastichePort: ${APP_PORT},
			localApiToken: '',
			sizeThreshold: 300,
			defaultDestinationId: null
		});
		return true;
	`
	);
	await client.request({ to: sidebar, type: 'reloadDescriptor', bypassCache: false });

	await poll(
		async () =>
			(
				await evaluateJson(
					client,
					sidebar,
					`({
				href: location.href,
				connected: document.body?.innerText.includes('Connected') ?? false,
				folder: document.body?.innerText.includes('Firefox acceptance') ?? false
			})`
				)
			).connected
				? true
				: null,
		'Firefox sidebar did not connect to the local Pastiche API.'
	);

	const ping = await browserCall(
		client,
		sidebar,
		`
		const tab = (await browser.tabs.query({})).find(
			(candidate) => candidate.url === ${JSON.stringify(fixtureUrl)}
		);
		if (!tab?.id) throw new Error('Fixture tab was not found.');
		let ping;
		try {
			ping = await browser.tabs.sendMessage(tab.id, { type: 'PASTICHE_CONTENT_PING' });
		} catch {
			await browser.scripting.executeScript({
				target: { tabId: tab.id },
				files: ['content/index.js']
			});
			ping = await browser.tabs.sendMessage(tab.id, { type: 'PASTICHE_CONTENT_PING' });
		}
		return ping;
	`
	);
	assert.deepEqual(ping, { ok: true });

	const batchClicked = await browserCall(
		client,
		sidebar,
		`
		const button = document.querySelector(
			'button[title="Scan the page for image candidates"]'
		);
		if (!button) return false;
		button.click();
		return true;
	`
	);
	assert.equal(batchClicked, true, 'Firefox embedded capture panel did not render Batch.');

	const captured = await poll(async () => {
		const tray = await captureTray(client, sidebar);
		const item = tray[0];
		return item?.fetchStatus?.state === 'done' ? item : null;
	}, 'Firefox embedded Batch control did not fetch and stage the captured original.');
	assert.equal(captured.storageMode, 'download');
	assert.equal(captured.storageModeReason, 'Original stored locally');
	assert.equal(captured.naturalWidth, 1200);
	assert.equal(captured.naturalHeight, 800);
	assert.equal(captured.fetchStatus.mimeType, 'image/png');
	assert.equal(captured.metadata.artist, 'Acceptance Artist');
	assert.equal(captured.metadata.artistUsername, 'acceptance_artist');
	assert.equal(
		captured.metadata.artistProfileUrl,
		`http://127.0.0.1:${FIXTURE_PORT}/acceptance_artist`
	);

	await clickButton(client, sidebar, 'Bookmark instead');
	await poll(
		async () =>
			(await evaluateJson(
				client,
				sidebar,
				`document.body?.innerText.includes('Bookmarked') ?? false`
			)) || null,
		'Firefox did not apply the Bookmark action in the sidebar UI.'
	);
	await poll(
		async () => (await captureTray(client, sidebar))[0]?.storageMode === 'lazy_download' || null,
		'Firefox did not persist the explicit Bookmark selection.'
	);

	await clickButton(client, sidebar, 'Import original');
	await poll(async () => {
		const item = (await captureTray(client, sidebar))[0];
		return item?.storageMode === 'download' && item.fetchStatus?.state === 'done' ? true : null;
	}, 'Firefox did not restore the bookmarked item to a local original.');

	await evaluateJson(
		client,
		sidebar,
		`(() => {
		const transfer = new DataTransfer();
		transfer.items.add(new File(
			['<svg xmlns="http://www.w3.org/2000/svg" width="1216" height="832"><rect width="1216" height="832" fill="#674b8d"/></svg>'],
			'novelai-dragon.svg',
			{ type: 'image/svg+xml' }
		));
		document.querySelector('main')?.dispatchEvent(new DragEvent('drop', {
			bubbles: true,
			cancelable: true,
			dataTransfer: transfer
		}));
		return true;
	})()`
	);

	const dropped = await poll(async () => {
		const tray = await captureTray(client, sidebar);
		return tray.find((item) => item.url?.startsWith('pastiche-drop://')) ?? null;
	}, 'Firefox did not stage a file dropped onto the sidebar.');
	assert.equal(dropped.storageMode, 'download');
	assert.equal(dropped.naturalWidth, 1216);
	assert.equal(dropped.naturalHeight, 832);
	assert.equal(dropped.mimeType, 'image/svg+xml');
	assert.equal(dropped.fetchStatus.state, 'done');
	assert.match(dropped.fetchStatus.blobKey, /^dropped-image:/);

	await browserCall(
		client,
		tabs.fixture.actor,
		`
		const image = new Image();
		image.src = '/drag-original.png';
		image.alt = 'Drag handoff';
		document.body.append(image);
		await image.decode();
		const transfer = new DataTransfer();
		image.dispatchEvent(new DragEvent('dragstart', {
			bubbles: true,
			cancelable: true,
			dataTransfer: transfer,
			clientX: image.getBoundingClientRect().left + 10,
			clientY: image.getBoundingClientRect().top + 10
		}));
		return true;
	`
	);

	const pendingState = await browserCall(
		client,
		sidebar,
		`
		const local = await browser.storage.local.get('pastiche_pending_image_drag');
		let session = {};
		try {
			session = await browser.storage.session.get('pastiche_pending_image_drag');
		} catch {}
		return {
			local: local.pastiche_pending_image_drag ?? null,
			session: session.pastiche_pending_image_drag ?? null
		};
	`
	);
	assert(
		pendingState.local || pendingState.session,
		'Firefox content drag did not persist a pending image handoff.'
	);
	assert.match(
		(pendingState.local ?? pendingState.session).item.url,
		/\/drag-original\.png$/,
		'Firefox pending drag did not preserve the newly dragged image URL.'
	);
	const embeddedPanel = await evaluateJson(
		client,
		tabs.fixture.actor,
		`({
		exists: Boolean(document.getElementById('__pastiche_drag_capture_panel__'))
	})`
	);
	assert.equal(
		embeddedPanel.exists,
		true,
		'Firefox did not expose its page-local drag target.'
	);

	const stagedEmbeddedDrop = await evaluateJson(
		client,
		tabs.fixture.actor,
		`(() => {
		const host = document.getElementById('__pastiche_drag_capture_panel__');
		if (!host) return { dropped: false, error: 'missing embedded panel' };
		const transfer = new DataTransfer();
		host.dispatchEvent(new DragEvent('dragover', {
			bubbles: true,
			cancelable: true,
			dataTransfer: transfer
		}));
		host.dispatchEvent(new DragEvent('drop', {
			bubbles: true,
			cancelable: true,
			dataTransfer: transfer
		}));
		return { dropped: true };
	})()`
	);
	assert.equal(
		stagedEmbeddedDrop.dropped,
		true,
		`Firefox page-local panel did not accept the drag: ${stagedEmbeddedDrop.error ?? ''}`
	);

	await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
	const postDropState = await browserCall(
		client,
		sidebar,
		`
		const local = await browser.storage.local.get('pastiche_pending_image_drag');
		let session = {};
		try {
			session = await browser.storage.session.get('pastiche_pending_image_drag');
		} catch {}
		return {
			localPending: Boolean(local.pastiche_pending_image_drag),
			sessionPending: Boolean(session.pastiche_pending_image_drag),
			text: document.body?.innerText ?? ''
		};
	`
	);
	assert.equal(
		postDropState.localPending || postDropState.sessionPending,
		false,
		`Firefox page-local capture panel did not consume the pending drag: ${postDropState.text}`
	);

	const strippedDrag = await poll(async () => {
		const tray = await captureTray(client, sidebar);
		return tray.find((item) => item.url?.includes('/drag-original.png')) ?? null;
	}, 'Firefox did not recover the page image after the page-local panel drop.');
	assert.equal(strippedDrag.storageMode, 'download');
	assert.equal(strippedDrag.fetchStatus.state, 'done');

	const sidebarState = await evaluateJson(
		client,
		sidebar,
		`({
		connected: document.body?.innerText.includes('Connected') ?? false,
		originalReady: document.body?.innerText.includes('Original ready') ?? false,
		folderSearch: Boolean(document.querySelector('input[type="search"]'))
	})`
	);
	assert.deepEqual(sidebarState, {
		connected: true,
		originalReady: true,
		folderSearch: true
	});

	console.log(
		'Firefox accepted the extension, connected its sidebar, captured originals, honored Bookmark opt-in, staged a dropped file, and completed a page-local-panel drag.'
	);
} finally {
	await runner?.exit().catch(() => undefined);
	await Promise.all([closeServer(appServer), closeServer(fixtureServer)]);
}

function handleAppRequest(request, response) {
	if (request.url?.startsWith('/api/status')) {
		respondJson(response, {
			connected: true,
			status_cursor: 'firefox-acceptance-1',
			unassigned_count: 0,
			recent_folders: [],
			folders: [
				{
					id: 'firefox-acceptance-folder',
					name: 'Firefox acceptance',
					parent_id: null,
					path: 'library/Firefox acceptance'
				}
			],
			imported_sources: []
		});
		return;
	}
	response.writeHead(404).end();
}

function handleFixtureRequest(request, response) {
	if (request.url === '/original.png' || request.url === '/drag-original.png') {
		response.writeHead(200, {
			'content-type': request.url === '/drag-original.png' ? 'PNG32' : 'image/png',
			'content-length': imageBytes.length,
			'cache-control': 'no-store'
		});
		response.end(imageBytes);
		return;
	}

	response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
	response.end(`<!doctype html>
		<html lang="en">
			<head><title>Firefox extension acceptance fixture</title></head>
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
}

function respondJson(response, body) {
	response.writeHead(200, {
		'content-type': 'application/json',
		'access-control-allow-origin': '*',
		'cache-control': 'no-store'
	});
	response.end(JSON.stringify(body));
}

function startServer(port, handler) {
	const server = createServer(handler);
	return new Promise((resolvePromise, reject) => {
		server.once('error', reject);
		server.listen(port, '127.0.0.1', () => resolvePromise(server));
	});
}

function closeServer(server) {
	return new Promise((resolvePromise, reject) => {
		server.close((error) => (error ? reject(error) : resolvePromise()));
	});
}

function installEvaluationRouter(client) {
	const originalHandleMessage = client._handleMessage.bind(client);
	const buffered = new Map();
	const pending = new Map();

	client._handleMessage = (message) => {
		if (message.type !== 'evaluationResult') {
			originalHandleMessage(message);
			return;
		}
		const resolver = pending.get(message.resultID);
		if (resolver) {
			pending.delete(message.resultID);
			resolver(message);
			return;
		}
		buffered.set(message.resultID, message);
	};

	client.waitForEvaluation = (resultId) => {
		const existing = buffered.get(resultId);
		if (existing) {
			buffered.delete(resultId);
			return Promise.resolve(existing);
		}
		return new Promise((resolvePromise, reject) => {
			const timeout = setTimeout(() => {
				pending.delete(resultId);
				reject(new Error(`Firefox evaluation ${resultId} timed out.`));
			}, 5_000);
			pending.set(resultId, (message) => {
				clearTimeout(timeout);
				resolvePromise(message);
			});
		});
	};
}

async function evaluate(client, tabActor, expression) {
	const target = await client.request({ to: tabActor, type: 'getTarget' });
	const acknowledgement = await client.request({
		to: target.frame.consoleActor,
		type: 'evaluateJSAsync',
		text: expression
	});
	const result = await client.waitForEvaluation(acknowledgement.resultID);
	if (result.hasException) {
		throw new Error(`Firefox evaluation failed: ${JSON.stringify(result.exception ?? result)}`);
	}
	return result.result;
}

async function evaluateJson(client, tabActor, expression) {
	const value = await evaluate(client, tabActor, `JSON.stringify(${expression})`);
	assert.equal(typeof value, 'string', `Firefox returned a non-JSON evaluation: ${String(value)}`);
	return JSON.parse(value);
}

async function browserCall(client, tabActor, body) {
	const key = `__pasticheAcceptance${browserCallSequence++}`;
	await evaluateJson(
		client,
		tabActor,
		`(() => {
			globalThis[${JSON.stringify(key)}] = { done: false };
			Promise.resolve().then(async () => {
				${body}
			}).then(
				(value) => { globalThis[${JSON.stringify(key)}] = { done: true, value }; },
				(error) => { globalThis[${JSON.stringify(key)}] = { done: true, error: String(error?.message ?? error) }; }
			);
			return true;
		})()`
	);

	const state = await poll(async () => {
		const current = await evaluateJson(
			client,
			tabActor,
			`globalThis[${JSON.stringify(key)}] ?? null`
		);
		return current?.done ? current : null;
	}, `Firefox browser call ${key} did not finish.`);
	if (state.error) throw new Error(state.error);
	return state.value;
}

async function captureTray(client, sidebar) {
	const stored = await browserCall(
		client,
		sidebar,
		`return await browser.storage.local.get('pastiche_capture_tray_items');`
	);
	return stored.pastiche_capture_tray_items ?? [];
}

async function clickButton(client, sidebar, label) {
	const clicked = await browserCall(
		client,
		sidebar,
		`
			const button = [...document.querySelectorAll('button')].find(
				(candidate) => candidate.textContent?.trim() === ${JSON.stringify(label)}
			);
			if (!button) return false;
			button.click();
			await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
			return true;
		`
	);
	assert.equal(clicked, true, `Firefox sidebar did not render the “${label}” action.`);
}

async function poll(operation, errorMessage, timeoutMs = 12_000) {
	const deadline = Date.now() + timeoutMs;
	let lastError;
	while (Date.now() < deadline) {
		try {
			const value = await operation();
			if (value) return value;
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
	}
	throw new Error(errorMessage, { cause: lastError });
}
