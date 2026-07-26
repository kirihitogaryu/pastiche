import { expect, test } from '@playwright/test';

const metResult = {
	id: 'met-437133',
	source: 'met',
	detailUrl: 'https://www.metmuseum.org/art/collection/search/437133',
	title: 'Wheat Field with Cypresses',
	artistRaw: 'Vincent van Gogh',
	artistBio: 'Dutch, 1853-1890',
	artistNationality: 'Dutch',
	dateDisplay: '1889',
	yearStart: 1889,
	yearEnd: 1889,
	medium: 'Oil on canvas',
	mediumCategory: 'oil',
	objectName: 'Painting',
	department: 'European Paintings',
	culture: null,
	period: null,
	thumbUrl:
		'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20800%201000%22%3E%3Crect%20width%3D%22800%22%20height%3D%221000%22%20fill%3D%22%233b3528%22/%3E%3Ccircle%20cx%3D%22400%22%20cy%3D%22350%22%20r%3D%22240%22%20fill%3D%22%23c6a45e%22/%3E%3Cpath%20d%3D%22M0%20760C210%20640%20360%20800%20800%20620V1000H0Z%22%20fill%3D%22%231e5b50%22/%3E%3C/svg%3E',
	imageUrl:
		'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20800%201000%22%3E%3Crect%20width%3D%22800%22%20height%3D%221000%22%20fill%3D%22%233b3528%22/%3E%3Ccircle%20cx%3D%22400%22%20cy%3D%22350%22%20r%3D%22240%22%20fill%3D%22%23c6a45e%22/%3E%3Cpath%20d%3D%22M0%20760C210%20640%20360%20800%20800%20620V1000H0Z%22%20fill%3D%22%231e5b50%22/%3E%3C/svg%3E',
	additionalImages: [],
	isIIIF: false,
	description: null,
	tags: ['Landscape', 'Cypress'],
	isHighlight: true,
	isPublicDomain: true,
	rawMetadata: {}
};

const articResult = {
	...metResult,
	id: 'artic-27992',
	source: 'artic',
	detailUrl: 'https://www.artic.edu/artworks/27992/a-sunday-on-la-grande-jatte',
	title: 'Art Institute Study',
	artistRaw: 'Georges Seurat',
	artistBio: 'French, 1859-1891',
	artistNationality: 'French',
	dateDisplay: '1884-86',
	yearStart: 1884,
	yearEnd: 1886,
	department: 'Painting and Sculpture of Europe',
	thumbUrl:
		'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20800%201000%22%3E%3Crect%20width%3D%22800%22%20height%3D%221000%22%20fill%3D%22%231f2937%22/%3E%3Ccircle%20cx%3D%22400%22%20cy%3D%22420%22%20r%3D%22260%22%20fill%3D%22%23e6c16f%22/%3E%3Cpath%20d%3D%22M80%20760C240%20620%20540%20800%20720%20620V1000H80Z%22%20fill%3D%22%236b8f71%22/%3E%3C/svg%3E',
	imageUrl: 'https://www.artic.edu/iiif/2/mock-artic-image-id',
	isIIIF: true,
	tags: ['Painting', 'Study']
};

const deviantArtSensitiveResult = {
	...metResult,
	id: 'deviantart-sensitive-study',
	source: 'deviantart',
	detailUrl: 'https://www.deviantart.com/example/art/sensitive-study',
	title: 'Sensitive DeviantArt Study',
	artistRaw: 'example',
	dateDisplay: '2015-06-01',
	yearStart: 2015,
	yearEnd: 2015,
	department: 'DeviantArt',
	contentRating: 'sensitive',
	rawMetadata: {
		deviantart: {
			favourites: 24,
			comments: 3,
			publishedAt: '2015-06-01T12:00:00.000Z'
		}
	}
};

const blueskyMultiImageResult = {
	...metResult,
	id: 'bluesky-multi-image-post',
	source: 'bluesky',
	detailUrl: 'https://bsky.app/profile/did:plc:test/post/3abc',
	title: 'Two dragon studies',
	artistRaw: 'Test Artist',
	department: 'Bluesky',
	objectName: 'Image post · 2 images',
	additionalImages: [`${metResult.imageUrl}#image-2`],
	isPublicDomain: false,
	contentRating: 'general',
	rawMetadata: {
		bluesky: {
			authorHandle: 'artist.example',
			imageCount: 2
		}
	}
};

const wikidataResult = {
	...metResult,
	id: 'wikidata-Q7559',
	source: 'wikidata',
	detailUrl: 'https://www.wikidata.org/wiki/Q7559',
	title: 'Saint George and the Dragon',
	artistRaw: 'Unknown artist',
	dateDisplay: '1500',
	yearStart: 1500,
	yearEnd: 1500,
	department: 'Wikidata',
	tags: ['dragon']
};

const wikidataRelatedResult = {
	...wikidataResult,
	id: 'wikidata-Q999',
	detailUrl: 'https://www.wikidata.org/wiki/Q999',
	title: 'Dragon Pendant',
	tags: ['pendant work']
};

function createWikidataResult(index: number) {
	return {
		...wikidataResult,
		id: `wikidata-Q7559-${index}`,
		title: `Wikidata Dragon Study ${index}`
	};
}

function createMetResult(id: number, title: string) {
	return {
		...metResult,
		id: `met-${id}`,
		detailUrl: `https://www.metmuseum.org/art/collection/search/${id}`,
		title
	};
}

test('production API imports retry idempotently and deletes from the isolated archive', async ({
	request
}) => {
	const importBody = {
		import_job_id: 'playwright-idempotency-check',
		destination_folder_id: null,
		items: [
			{
				filename: 'Playwright archive check.svg',
				storage_mode: 'download',
				image_data: Buffer.from(
					'<svg xmlns="http://www.w3.org/2000/svg" width="8" height="6"><rect width="8" height="6" fill="#8b5e3c"/></svg>'
				).toString('base64'),
				source_image_url: null,
				mime_type: 'image/svg+xml',
				natural_width: 8,
				natural_height: 6,
				source_url: 'https://example.test/playwright-archive-check',
				page_title: 'Playwright archive check',
				alt_text: null,
				captured_at: '2026-07-22T12:00:00.000Z'
			}
		]
	};

	const first = await request.post('/api/import', { data: importBody });
	const second = await request.post('/api/import', { data: importBody });
	expect(first.ok()).toBe(true);
	expect(second.ok()).toBe(true);
	const firstResult = (await first.json()) as { imported: Array<{ asset_id: string }> };
	expect(await second.json()).toEqual(firstResult);

	const importedStatus = await request.get('/api/status');
	expect(await importedStatus.json()).toMatchObject({ unassigned_count: 1 });

	const deleted = await request.delete(
		`/api/library/assets/${encodeURIComponent(firstResult.imported[0].asset_id)}`
	);
	expect(deleted.ok()).toBe(true);
	const deletedStatus = await request.get('/api/status');
	expect(await deletedStatus.json()).toMatchObject({ unassigned_count: 0 });
});

async function mockExploreApi(page: import('@playwright/test').Page) {
	let secondPageAttempts = 0;
	const searchRequests: Array<{
		source?: string;
		cursor?: string;
		keyword?: string;
		artist?: string;
		tag?: string;
		wikidataMode?: string;
		wikidataEntities?: Array<{ id: string; label: string; description: string | null }>;
		depicts?: Array<{ id: string; label: string; description: string | null }>;
	}> = [];

	await page.route('**/explore/api/departments**', async (route) => {
		const source = new URL(route.request().url()).searchParams.get('source') ?? 'met';
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				departments: source === 'artic' ? [] : [{ id: '11', label: 'European Paintings' }]
			})
		});
	});
	await page.route('**/explore/api/wikidata/entities**', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				entities: [
					{
						id: 'Q7559',
						label: 'dragon',
						description: 'legendary winged, fire-breathing reptile'
					}
				]
			})
		});
	});
	await page.route('**/explore/api/wikidata/related/**', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				seedId: 'wikidata-Q7559',
				title: 'Similar to Saint George and the Dragon',
				items: [wikidataRelatedResult],
				total: null,
				nextCursor: null
			})
		});
	});
	await page.route('**/explore/api/search', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 120));
		const body = route.request().postDataJSON() as {
			source?: string;
			query?: {
				cursor?: string;
				keyword?: string;
				artist?: string;
				tag?: string;
				wikidataMode?: string;
				wikidataEntities?: Array<{ id: string; label: string; description: string | null }>;
				depicts?: Array<{ id: string; label: string; description: string | null }>;
			};
			cursor?: string;
			keyword?: string;
			artist?: string;
			tag?: string;
		};
		const source = body.source ?? 'met';
		const request = { ...(body.query ?? body), source } as (typeof searchRequests)[number];
		searchRequests.push(request);
		if (source === 'deviantart') {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					items: [deviantArtSensitiveResult],
					total: null,
					nextCursor: null
				})
			});
			return;
		}
		if (source === 'bluesky') {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					items: request.artist ? [blueskyMultiImageResult] : [],
					total: null,
					nextCursor: null
				})
			});
			return;
		}
		if (source === 'artic') {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					items: [articResult],
					total: 1,
					nextCursor: null
				})
			});
			return;
		}
		if (source === 'wikidata') {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					items:
						request.depicts?.length || request.wikidataEntities?.length || request.keyword
							? [wikidataResult]
							: [],
					total: null,
					nextCursor: null
				})
			});
			return;
		}
		if (request.cursor === '20' && secondPageAttempts === 0) {
			secondPageAttempts += 1;
			await route.fulfill({
				status: 503,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'The Met is rate-limiting requests. Try again in a moment.' })
			});
			return;
		}
		if (request.cursor === '20') secondPageAttempts += 1;

		const pageItems =
			request.tag === 'Landscape'
				? [createMetResult(500101, 'Landscape Tag Result')]
				: request.keyword === 'dragons'
					? [createMetResult(500202, 'Dragon Study')]
					: request.cursor === '20'
						? [createMetResult(500001, 'The Second Page Study')]
						: [
								metResult,
								...Array.from({ length: 19 }, (_, index) =>
									createMetResult(440000 + index, `Met Browse Result ${index + 2}`)
								)
							];
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				items: pageItems,
				total: 21,
				nextCursor:
					request.cursor === '20' || request.tag === 'Landscape' || request.keyword === 'dragons'
						? null
						: '20'
			})
		});
	});

	return { searchRequests };
}

test('website Explore saves and restores a scoped artist search', async ({ page }) => {
	await mockExploreApi(page);
	let savedSearch: Record<string, unknown> | null = null;
	const timestamp = '2026-07-24T12:00:00.000Z';

	await page.route('**/explore/api/saved-searches**', async (route) => {
		const method = route.request().method();
		if (method === 'GET') {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({ searches: savedSearch ? [savedSearch] : [] })
			});
			return;
		}
		if (method === 'POST') {
			const body = route.request().postDataJSON() as {
				source: string;
				mode: string;
				query: string;
				filters: Record<string, unknown>;
			};
			savedSearch = {
				id: 'saved-deviantart-loish',
				source: body.source,
				mode: body.mode,
				query: body.query,
				label: body.query,
				filters: body.filters,
				createdAt: timestamp,
				updatedAt: timestamp,
				lastOpenedAt: null,
				lastSeenItemId: null,
				lastSeenPublishedAt: null
			};
			await route.fulfill({
				status: 201,
				contentType: 'application/json',
				body: JSON.stringify({ search: savedSearch, created: true })
			});
			return;
		}
		if (method === 'PATCH') {
			const patch = route.request().postDataJSON() as Record<string, unknown>;
			savedSearch = { ...savedSearch, ...patch, updatedAt: timestamp };
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({ search: savedSearch })
			});
			return;
		}
		await route.fulfill({ status: 204 });
	});

	await page.goto('/');
	const primary = page.getByRole('navigation', { name: 'Primary' });
	await primary.getByRole('button', { name: 'Explore' }).click();
	await expect(page.getByRole('heading', { name: 'Explore', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Other website' }).click();
	await expect(page.locator('.topbar')).toHaveCount(0);

	await page.getByLabel('Website').selectOption('deviantart');
	const artistSearch = page.getByRole('textbox', { name: 'DeviantArt artist' });
	await artistSearch.fill('loish');
	await page.getByRole('button', { name: 'Filter' }).click();
	const filters = page.getByRole('complementary', { name: 'Filters' });
	await filters.getByRole('button', { name: 'Most popular' }).click();
	await filters.getByLabel('Before').fill('2016-01-01');
	await filters.getByRole('button', { name: 'Close filters' }).click();

	await page.getByRole('button', { name: 'Save current search' }).click();
	await expect(page.getByText('Search saved', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Update saved search' })).toBeVisible();
	const sensitiveResult = page.getByRole('button', {
		name: 'Reveal sensitive image Sensitive DeviantArt Study'
	});
	await expect(sensitiveResult).toBeVisible();
	await sensitiveResult.click();
	await expect(
		page.getByRole('button', { name: 'Inspect Sensitive DeviantArt Study' })
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Sensitive DeviantArt Study' })).toHaveCount(0);

	await artistSearch.fill('another artist');
	await page.getByRole('button', { name: 'Saved', exact: true }).click();
	const savedPanel = page.getByRole('dialog', { name: 'Saved searches' });
	await expect(savedPanel.getByText('DeviantArt · Artists')).toBeVisible();
	await savedPanel.getByRole('button', { name: /^loish / }).click();
	await expect(artistSearch).toHaveValue('loish');

	await page.getByRole('button', { name: 'Filter' }).click();
	await expect(filters.getByRole('button', { name: 'Most popular' })).toHaveClass(/active/);
	await expect(filters.getByLabel('Before')).toHaveValue('2016-01-01');
});

test('website Explore exposes source capabilities and selects Bluesky post images', async ({
	page
}) => {
	await mockExploreApi(page);
	await page.goto('/');
	const primary = page.getByRole('navigation', { name: 'Primary' });
	await primary.getByRole('button', { name: 'Explore' }).click();
	await page.getByRole('button', { name: 'Other website' }).click();

	await page.getByLabel('Website').selectOption('furaffinity');
	await expect(page.getByRole('button', { name: 'Tags' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Artist' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page.getByLabel('Website').selectOption('bluesky');
	await page.getByRole('button', { name: 'Filter' }).click();
	const filters = page.getByRole('complementary', { name: 'Filters' });
	await expect(filters.getByRole('heading', { name: 'Content visibility' })).toBeVisible();
	await filters.getByRole('button', { name: 'Close filters' }).click();
	const search = page.getByRole('textbox', { name: 'Bluesky artist' });
	await search.fill('artist.example');
	await page.getByRole('button', { name: 'Search Bluesky' }).click();
	const card = page.getByRole('button', { name: 'Inspect Two dragon studies' });
	await expect(card).toBeVisible();
	await expect(card.locator('[aria-label="2 images"]')).toBeVisible();
	await card.click();

	const inspector = page.getByRole('complementary', { name: 'Explore detail' });
	await expect(inspector.getByText('Image 1 of 2')).toBeVisible();
	const secondImage = inspector.getByRole('button', { name: 'View image 2 of 2' });
	const selectorSize = await secondImage.boundingBox();
	expect(selectorSize?.width).toBeGreaterThanOrEqual(50);
	expect(selectorSize?.height).toBeGreaterThanOrEqual(50);
	await secondImage.click();
	await expect(inspector.getByText('Image 2 of 2')).toBeVisible();
	await expect(secondImage).toHaveAttribute('aria-pressed', 'true');
});

test('desktop library and explore surfaces are navigable', async ({ page }) => {
	test.setTimeout(60_000);
	const exploreApi = await mockExploreApi(page);
	await page.goto('/');

	const primary = page.getByRole('navigation', { name: 'Primary' });
	await primary.getByRole('button', { name: 'Atlas' }).click();
	await expect(page.getByRole('region', { name: 'Atlas home' })).toBeVisible();
	await expect(page.locator('.atlas-command').getByRole('heading', { name: 'Atlas' })).toBeVisible();
	await expect(page.locator('.atlas-command .shell-home')).toBeHidden();
	await expect(
		page.getByRole('button', { name: 'Open Atlas inspect for Crimson Horizon' })
	).toBeVisible();
	await expect(page.getByRole('region', { name: /Atlas inspect Crimson Horizon/ })).toHaveCount(0);
	await expect(page.getByText('No library assets are available yet.')).toHaveCount(0);
	await page.getByRole('button', { name: 'Open Atlas inspect for Crimson Horizon' }).click();
	await expect(page.getByRole('region', { name: /Atlas inspect Crimson Horizon/ })).toBeVisible();
	await expect(page.getByPlaceholder('Search artwork, artists, or collections...')).toHaveCount(0);
	const atlasInspect = page.getByRole('region', { name: /Atlas inspect Crimson Horizon/ });
	await expect(atlasInspect.getByRole('button', { name: 'Atlas Wiki' })).toHaveCount(0);
	await expect(atlasInspect.getByRole('button', { name: 'Generate tags' })).toBeVisible();
	await expect(atlasInspect.getByRole('button', { name: 'Hide metadata sidebar' })).toBeVisible();
	await atlasInspect.getByRole('button', { name: 'Hide metadata sidebar' }).click();
	await expect(page.getByRole('complementary', { name: 'Atlas asset metadata' })).toBeHidden();
	await expect(atlasInspect.getByRole('button', { name: 'Show metadata sidebar' })).toBeVisible();
	await atlasInspect.getByRole('button', { name: 'Show metadata sidebar' }).click();
	await expect(page.getByRole('complementary', { name: 'Atlas asset metadata' })).toBeVisible();
	const atlasViewer = page
		.getByRole('group', { name: 'Interactive preview of Crimson Horizon' })
		.getByRole('img', { name: 'Crimson Horizon' });
	await expect(atlasViewer).toBeVisible();
	await atlasViewer.hover();
	await page.mouse.wheel(0, -400);
	await expect(page.getByText('112%')).toBeVisible();
	await atlasInspect
		.getByRole('button', { name: 'Open focused preview for Crimson Horizon' })
		.click();
	const focusedPreview = page.getByRole('dialog', { name: 'Focused library image preview' });
	await expect(focusedPreview).toBeVisible();
	const previewLayout = await focusedPreview.evaluate((dialog) => {
		const panel = dialog.querySelector<HTMLElement>('.preview-panel');
		const identity = dialog.querySelector<HTMLElement>('.identity-line');
		if (!panel || !identity) return null;
		const panelRect = panel.getBoundingClientRect();
		return {
			widthRatio: panelRect.width / window.innerWidth,
			heightRatio: panelRect.height / window.innerHeight,
			identityDisplay: getComputedStyle(identity).display
		};
	});
	expect(previewLayout).not.toBeNull();
	expect(previewLayout?.widthRatio).toBeGreaterThan(0.9);
	expect(previewLayout?.heightRatio).toBeGreaterThan(0.9);
	expect(previewLayout?.identityDisplay).toBe('flex');
	await focusedPreview.getByRole('button', { name: 'Close focused preview' }).click();
	await page.getByRole('button', { name: 'Back to Atlas' }).click();
	await expect(page.getByRole('region', { name: 'Atlas home' })).toBeVisible();
	const atlasSearch = page.getByRole('textbox', { name: 'Atlas search' });
	const atlasHelp = page.getByRole('button', { name: 'Search syntax help' });
	const desktopCommandAlignment = await page.evaluate(() => {
		const search = document.querySelector<HTMLElement>('.atlas-command .search-box');
		const help = document.querySelector<HTMLElement>('.atlas-command .help');
		if (!search || !help) return null;
		const searchRect = search.getBoundingClientRect();
		const helpRect = help.getBoundingClientRect();
		return Math.abs(searchRect.top + searchRect.height / 2 - (helpRect.top + helpRect.height / 2));
	});
	await expect(atlasSearch).toBeVisible();
	await expect(atlasHelp).toBeVisible();
	expect(desktopCommandAlignment).not.toBeNull();
	expect(desktopCommandAlignment ?? Number.POSITIVE_INFINITY).toBeLessThan(2);
	await page
		.getByRole('navigation', { name: 'Atlas local modes' })
		.getByRole('button', { name: 'Wiki' })
		.click();
	await expect(page.getByRole('region', { name: 'Atlas wiki' })).toBeVisible();
	await page.getByLabel('Search wiki').fill('serpent');
	await page
		.getByRole('complementary', { name: 'Atlas wiki navigation' })
		.getByRole('button', { name: 'serpent', exact: true })
		.click();
	await expect(page.getByRole('heading', { name: 'Serpent' })).toBeVisible();
	await expect(page.getByText('Allowed Classifiers')).toBeVisible();
	await expect(
		page
			.getByRole('button', { name: 'Generate entry' })
			.or(page.getByRole('button', { name: 'Entry complete' }))
	).toBeVisible();
	await page.getByRole('button', { name: 'Back to Atlas browse' }).click();
	await expect(page.getByRole('region', { name: 'Atlas home' })).toBeVisible();

	await primary.getByRole('button', { name: 'Library' }).click();
	await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
	await expect(page.getByRole('searchbox', { name: 'Search folders' })).toBeVisible();
	await expect(page.getByRole('searchbox', { name: 'Search images' })).toBeVisible();
	const librarySidebar = page.getByRole('complementary', { name: 'Library folders' });
	await expect(librarySidebar).toBeVisible();
	await librarySidebar.getByRole('button', { name: /Recently Added/ }).click();
	await expect(page.getByRole('heading', { name: 'Recently Added' })).toBeVisible();
	await page.getByRole('button', { name: 'Open filters' }).click();
	await expect(page.getByRole('complementary', { name: 'Filters' })).toBeVisible();
	await page
		.getByRole('complementary', { name: 'Filters' })
		.getByRole('button', { name: 'Close filters' })
		.click();
	await expect(page.getByRole('button', { name: 'Inspect Crimson Horizon' })).toBeVisible();
	await page.getByRole('button', { name: 'Inspect Crimson Horizon' }).click();
	await expect(page.getByRole('heading', { name: 'Crimson Horizon' })).toBeVisible();
	await expect(page.getByRole('complementary', { name: 'Image inspector' })).toBeVisible();
	await page.getByRole('button', { name: 'Open zoom preview for Crimson Horizon' }).click();
	const focusedImage = page.locator('.image-stage img[alt="Crimson Horizon"]');
	await expect(focusedImage).toBeVisible();
	await expect
		.poll(async () => {
			return focusedImage.evaluate((element) => {
				const dataTransfer = new DataTransfer();
				element.dispatchEvent(
					new DragEvent('dragstart', {
						bubbles: true,
						cancelable: true,
						dataTransfer
					})
				);
				return {
					fileCount: dataTransfer.files.length,
					fileName: dataTransfer.files.item(0)?.name ?? '',
					uri: dataTransfer.getData('text/uri-list'),
					download: dataTransfer.getData('DownloadURL')
				};
			});
		})
		.toMatchObject({
			fileCount: 1,
			fileName: expect.stringMatching(/^Crimson Horizon\.(?:avif|gif|jpe?g|png|svg|webp)$/i),
			uri: expect.stringMatching(/^(?:\/api\/library\/assets\/|data:image\/)/),
			download: expect.stringContaining(':Crimson Horizon.')
		});
	await page.getByRole('button', { name: 'Close focused preview' }).click();
	await page.getByRole('button', { name: 'Open in Atlas' }).click();
	await expect(primary.getByRole('button', { name: 'Atlas' })).toHaveClass(/active/);
	await expect(page.getByRole('region', { name: /Atlas inspect Crimson Horizon/ })).toBeVisible();
	await expect(page.getByPlaceholder('Search artwork, artists, or collections...')).toHaveCount(0);
	await expect(page.getByRole('complementary', { name: 'Atlas asset metadata' })).toBeVisible();
	await expect(page.getByLabel('Filter metadata')).toBeVisible();
	await expect(page.getByText('Canonical Visual Tags')).toBeVisible();
	await expect(page.getByText('Annotations / Regions')).toBeVisible();
	await expect(page.getByLabel('Open wiki entry landscape').first()).toBeVisible();
	await expect(page.getByText('position: center').first()).toBeVisible();
	await page.getByLabel('Filter metadata').fill('source');
	await expect(page.getByText('Source Claims')).toBeVisible();
	await expect(page.getByText('AI Generation Metadata')).toBeVisible();
	await primary.getByRole('button', { name: 'Library' }).click();
	await expect(page.getByRole('heading', { name: 'Recently Added' })).toBeVisible();
	const favoriteToggle = page.getByRole('button', {
		name: /^(?:Favorite Crimson Horizon|Remove Crimson Horizon from favorites)$/
	});
	await page
		.locator('.asset-card')
		.filter({ has: page.getByRole('button', { name: 'Inspect Crimson Horizon' }) })
		.hover();
	await expect(favoriteToggle).toBeVisible();
	await expect(page.getByRole('menu', { name: 'Crimson Horizon actions' })).toHaveCount(0);
	await page.route('**/api/atlas/tags/resolve', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				candidates: [
					{
						id: 'library-search-abstract',
						raw: 'abstract',
						expression: 'abstract',
						label: 'Abstract',
						kind: 'existing',
						confidence: 'high',
						reason: 'Exact Atlas tag.',
						patch: {},
						alternatives: [],
						nearby: [],
						searchable: true,
						established: true
					}
				]
			})
		});
	});
	await page.route('**/api/atlas/concepts?*', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ concepts: [] })
		});
	});
	const librarySearch = page.getByRole('searchbox', { name: 'Search images' });
	await librarySearch.fill('abstract');
	const atlasSuggestions = page.getByRole('listbox', { name: 'Atlas tag suggestions' });
	await expect(atlasSuggestions).toBeVisible();
	await expect(atlasSuggestions.getByRole('option').first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Inspect Crimson Horizon' })).toBeVisible();
	await librarySearch.fill('');
	await page.getByRole('button', { name: 'Inspect Crimson Horizon' }).click();
	await expect(page.getByRole('heading', { name: 'Crimson Horizon' })).toBeVisible();
	await expect(page.getByRole('menu', { name: 'Crimson Horizon actions' })).toHaveCount(0);

	await primary.getByRole('button', { name: 'Explore' }).click();
	await expect(page.locator('.topbar')).toHaveCount(0);
	await expect(page.getByPlaceholder('Search artwork, artists, or collections...')).toBeVisible();
	await expect(page.locator('.skeleton').first()).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Inspect Wheat Field with Cypresses' })
	).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Inspect Wheat Field with Cypresses' }).locator('img')
	).toHaveAttribute('fetchpriority', 'high');
	await expect(
		page.getByRole('button', { name: 'Inspect Met Browse Result 7' }).locator('img')
	).toHaveAttribute('fetchpriority', 'auto');
	await expect(page.getByText('Showing 20 of 21 matches')).toBeVisible();
	await page.getByRole('button', { name: 'Art Institute of Chicago' }).click();
	await expect(page.getByRole('button', { name: /Inspect Art Institute Study/ })).toBeVisible();
	await page.getByRole('button', { name: 'Filter' }).click();
	await expect(page.getByRole('complementary', { name: 'Filters' })).toContainText(
		'Art Institute of Chicago results'
	);
	await expect(
		page
			.getByRole('complementary', { name: 'Filters' })
			.getByRole('button', { name: 'Art Institute of Chicago' })
	).toBeVisible();
	await page
		.getByRole('complementary', { name: 'Filters' })
		.getByRole('button', { name: 'Close filters' })
		.click();
	await expect(
		page
			.getByRole('button', { name: /Inspect Art Institute Study/ })
			.getByText('Art Institute', { exact: true })
	).toBeVisible();
	expect(exploreApi.searchRequests.some((request) => request.source === 'artic')).toBe(true);
	await page.getByRole('button', { name: /Inspect Art Institute Study/ }).click();
	await expect(page.getByRole('heading', { name: 'Art Institute Study' })).toBeVisible();
	await expect(
		page
			.getByRole('button', { name: 'Open focused preview for Art Institute Study' })
			.locator('img')
	).toHaveAttribute('src', /mock-artic-image-id\/full\/1200,\/0\/default\.jpg/);
	await page.getByRole('button', { name: 'Open focused preview for Art Institute Study' }).click();
	await expect(
		page.getByRole('dialog', { name: 'Focused art preview' }).locator('img')
	).toHaveAttribute('src', /mock-artic-image-id\/full\/1600,\/0\/default\.jpg/);
	await page.keyboard.press('Shift+Tab');
	await expect(
		page
			.getByRole('dialog', { name: 'Focused art preview' })
			.getByRole('button', { name: 'Zoom in' })
	).toBeFocused();
	await page.getByRole('button', { name: 'Close focused preview' }).click();
	await page.getByRole('button', { name: 'Close inspector' }).click();
	await page.getByPlaceholder('Search artwork, artists, or collections...').fill('paint');
	await expect(page.getByRole('option', { name: 'Painting tag Art Institute' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Search Art Institute of Chicago' })).toBeVisible();
	await page.getByRole('option', { name: 'Painting tag Art Institute' }).click();
	await expect
		.poll(() =>
			exploreApi.searchRequests.some(
				(request) => request.source === 'artic' && request.tag === 'Painting'
			)
		)
		.toBe(true);
	await page.getByRole('button', { name: 'The Met', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Inspect Wheat Field with Cypresses' })
	).toBeVisible();
	await page.getByRole('button', { name: 'Wikimedia' }).click();
	await expect(page.locator('.topbar')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Art', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByLabel('Artwork search mode')).toHaveValue('depicts');
	await expect(
		page.getByLabel('Artwork search mode').getByRole('option', { name: 'Main subject' })
	).toBeAttached();
	await expect(page.getByLabel('Search depicted subjects')).toHaveCount(0);
	const subjectSearch = page.getByRole('textbox', { name: 'Search Wikimedia' });
	await expect(subjectSearch).toHaveAttribute('placeholder', 'Search depicted subjects...');
	await subjectSearch.fill('dragon');
	await expect(
		page.getByRole('option', { name: /dragon legendary winged, fire-breathing reptile/ })
	).toBeVisible();
	await page.getByRole('option', { name: /dragon legendary winged/ }).click();
	await expect(page.getByRole('button', { name: 'Remove dragon' })).toBeVisible();
	await expect(
		page.getByRole('button', { name: /Inspect Saint George and the Dragon/ })
	).toBeVisible();
	await page.getByRole('button', { name: /Inspect Saint George and the Dragon/ }).click();
	await page
		.getByRole('complementary', { name: 'Explore detail' })
		.evaluate((element) => element.scrollTo(0, element.scrollHeight));
	await expect(
		page.getByRole('button', { name: 'Inspect related work Dragon Pendant' })
	).toBeVisible();
	await page
		.getByRole('button', { name: 'Open all works related to Saint George and the Dragon' })
		.click();
	await expect(page.getByText('Similar to Saint George and the Dragon')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Inspect Dragon Pendant' })).toBeVisible();
	expect(
		exploreApi.searchRequests.some(
			(request) => request.source === 'wikidata' && request.wikidataMode === 'depicts'
		)
	).toBe(true);
	await page.getByRole('button', { name: 'Return to subject search' }).click();
	await page.getByLabel('Artwork search mode').selectOption('main_subject');
	await expect(subjectSearch).toHaveAttribute('placeholder', 'Search main subjects...');
	await expect(page.getByRole('button', { name: 'Remove dragon' })).toHaveCount(0);
	await subjectSearch.fill('dragon');
	await page.getByRole('option', { name: /dragon legendary winged/ }).click();
	await expect(
		page.getByRole('button', { name: /Inspect Saint George and the Dragon/ })
	).toBeVisible();
	expect(
		exploreApi.searchRequests.some(
			(request) =>
				request.source === 'wikidata' &&
				request.wikidataMode === 'main_subject' &&
				request.wikidataEntities?.some((entity) => entity.id === 'Q7559')
		)
	).toBe(true);
	await page.getByLabel('Artwork search mode').selectOption('title');
	await expect(subjectSearch).toHaveAttribute('placeholder', 'Search artwork titles...');
	await subjectSearch.fill('Saint George');
	await page.getByRole('button', { name: 'Search Wikimedia' }).click();
	await expect(
		page.getByRole('button', { name: /Inspect Saint George and the Dragon/ })
	).toBeVisible();
	expect(
		exploreApi.searchRequests.some(
			(request) =>
				request.source === 'wikidata' &&
				request.wikidataMode === 'title' &&
				request.keyword === 'Saint George'
		)
	).toBe(true);
	await page.getByRole('button', { name: 'Save current search' }).click();
	await expect(page.getByText('Search saved', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Saved', exact: true }).click();
	const wikimediaSaved = page.getByRole('dialog', { name: 'Saved searches' });
	await expect(wikimediaSaved.getByText('Wikimedia · Art')).toBeVisible();
	await expect(wikimediaSaved.getByRole('button', { name: /^Saint George / })).toBeVisible();
	await wikimediaSaved.getByRole('button', { name: 'Close saved searches' }).click();
	await page.getByRole('button', { name: 'The Met', exact: true }).click();
	await expect(page.getByRole('button', { name: /Add .* to library/i })).toHaveCount(0);
	await expect(page.getByRole('complementary', { name: 'Explore detail' })).toHaveCount(0);
	await page.locator('.scroll-area').evaluate((node) => {
		node.scrollTop = 120;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(page.getByText('Search by:')).toBeHidden();
	await expect(page.locator('.topbar')).toHaveCount(0);
	await page.getByPlaceholder('Search artwork, artists, or collections...').fill('land');
	await expect(page.getByRole('listbox', { name: 'Explore search suggestions' })).toBeVisible();
	await page.waitForTimeout(320);
	expect(exploreApi.searchRequests.some((request) => request.keyword === 'land')).toBe(false);
	await page.getByRole('option', { name: 'Landscape tag The Met' }).click();
	await expect(page.getByPlaceholder('Search artwork, artists, or collections...')).toHaveValue(
		'Landscape'
	);
	await expect(page.getByRole('button', { name: 'Inspect Landscape Tag Result' })).toBeVisible();
	await page.getByPlaceholder('Search artwork, artists, or collections...').fill('dragons');
	await page.waitForTimeout(320);
	expect(exploreApi.searchRequests.some((request) => request.keyword === 'dragons')).toBe(false);
	await page.getByRole('button', { name: 'Search The Met' }).click();
	await expect(page.getByRole('button', { name: 'Inspect Dragon Study' })).toBeVisible();
	await page.getByPlaceholder('Search artwork, artists, or collections...').fill('');
	await page.getByPlaceholder('Search artwork, artists, or collections...').press('Enter');
	await expect(
		page.getByRole('button', { name: 'Inspect Wheat Field with Cypresses' })
	).toBeVisible();
	await page.locator('.scroll-area').evaluate((node) => {
		node.scrollTop = node.scrollHeight;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(
		page.getByText('The Met is rate-limiting requests. Try again in a moment.')
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Retry loading Met results' })).toBeVisible();
	await page.getByRole('button', { name: 'Retry loading Met results' }).click();
	await expect(page.getByText('Loading more Met results...')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Inspect The Second Page Study' })).toBeVisible();
	await expect(page.getByText('Showing 21 of 21 matches')).toBeVisible();
	await page.locator('.scroll-area').evaluate((node) => {
		node.scrollTop = 0;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await page.getByRole('button', { name: 'Inspect Wheat Field with Cypresses' }).click();
	await expect(page.getByRole('heading', { name: 'Wheat Field with Cypresses' })).toBeVisible();
	await expect(
		page
			.getByRole('complementary', { name: 'Explore detail' })
			.getByRole('button', { name: 'Save original' })
	).toBeEnabled();
	await page
		.getByRole('button', { name: 'Open focused preview for Wheat Field with Cypresses' })
		.click();
	await expect(page.getByRole('dialog', { name: 'Focused art preview' })).toBeVisible();
	await expect(page.getByText('100%')).toBeVisible();
	await page.getByRole('button', { name: 'Zoom in' }).click();
	await expect(page.getByText('125%')).toBeVisible();
	await page.getByRole('button', { name: 'Reset zoom' }).click();
	await expect(page.getByText('100%')).toBeVisible();
	await page.getByRole('button', { name: 'Close focused preview' }).first().click();
	await expect(page.getByRole('dialog', { name: 'Focused art preview' })).toBeHidden();
	await page.locator('.scroll-area').evaluate((node) => {
		node.scrollTop = 0;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(page.locator('.topbar')).toHaveCount(0);
});

test('Atlas tag suggestions are manual, collapsible, and apply multiple selections in place', async ({
	page
}) => {
	test.setTimeout(60_000);
	let createRequests = 0;
	let appliedSelections: Array<{ suggestionId: string }> = [];

	await page.route('**/api/atlas/agent-runs**', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		if (url.pathname.endsWith('/apply-tags')) {
			const body = request.postDataJSON() as {
				selections?: Array<{ suggestionId: string }>;
			};
			appliedSelections = body.selections ?? [];
			const libraryResponse = await page.request.get('/api/library');
			const library = (await libraryResponse.json()) as {
				assets: Array<{ id: string; title: string }>;
			};
			const asset = library.assets.find((item) => item.title === 'Crimson Horizon')!;
			const atlasResponse = await page.request.get(
				`/api/library/assets/${encodeURIComponent(asset.id)}/atlas`
			);
			const atlasBody = (await atlasResponse.json()) as { asset: unknown; atlas: unknown };
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					...atlasBody,
					appliedSuggestionIds: appliedSelections.map((item) => item.suggestionId)
				})
			});
			return;
		}

		if (request.method() === 'POST') {
			createRequests += 1;
			const libraryResponse = await page.request.get('/api/library');
			const library = (await libraryResponse.json()) as {
				assets: Array<{ id: string; title: string }>;
			};
			const asset = library.assets.find((item) => item.title === 'Crimson Horizon')!;
			await route.fulfill({
				status: 202,
				contentType: 'application/json',
				body: JSON.stringify({
					run: {
						id: 'atlas-agent-e2e',
						job: 'tag_suggestions',
						targetType: 'asset',
						targetId: asset.id,
						status: 'succeeded',
						stage: 'complete',
						visionModel: 'test-vision',
						textModel: 'test-text',
						policyVersion: 'test',
						policyHash: 'test',
						contextSummary: {},
						result: {
							observations: ['A dragon with visible wings.'],
							neighborhood: { seeds: ['dragon'], concepts: [], truncated: false, characters: 0 },
							suggestions: [
								{
									id: 'suggestion-dragon',
									raw: 'dragon',
									expression: 'dragon',
									label: 'Dragon',
									kind: 'existing',
									confidence: 'high',
									reason: 'A dragon is visibly depicted.',
									patch: {},
									alternatives: [],
									nearby: []
								},
								{
									id: 'suggestion-wings',
									raw: 'wings',
									expression: 'wings',
									label: 'Wings',
									kind: 'existing',
									confidence: 'high',
									reason: 'Visible wings are present.',
									patch: {},
									alternatives: [],
									nearby: []
								}
							]
						},
						error: null,
						usage: { total_tokens: 123 },
						retryOf: null,
						createdAt: '2026-07-24T12:00:00.000Z',
						updatedAt: '2026-07-24T12:00:00.000Z'
					}
				})
			});
			return;
		}

		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				run: null,
				usage: { weeklyTokens: 456, weeklyBudget: 30_000_000, successfulRuns: 2 }
			})
		});
	});

	await page.goto('/');
	const primary = page.getByRole('navigation', { name: 'Primary' });
	await primary.getByRole('button', { name: 'Atlas' }).click();
	await expect(page.getByRole('region', { name: 'Atlas home' })).toBeVisible();
	await page.getByRole('button', { name: 'Open Atlas inspect for Crimson Horizon' }).click();
	const inspect = page.getByRole('region', { name: /Atlas inspect Crimson Horizon/ });
	await expect(inspect).toBeVisible();
	await inspect.getByRole('button', { name: 'More image actions' }).click();
	const imageActions = inspect.getByRole('menu', { name: 'Image actions' });
	await expect(imageActions.getByRole('menuitem', { name: 'Download image' })).toBeVisible();
	const downloadStarted = page.waitForEvent('download');
	await imageActions.getByRole('menuitem', { name: 'Download image' }).click();
	await expect
		.poll(async () => (await downloadStarted).suggestedFilename())
		.toMatch(/^crimson-horizon\./);
	await inspect.getByRole('button', { name: 'More image actions' }).click();
	await imageActions.getByRole('menuitem', { name: 'Delete image' }).click();
	const deleteConfirmation = imageActions.getByRole('alert');
	await expect(deleteConfirmation.getByText('Delete this image?')).toBeVisible();
	await deleteConfirmation.getByRole('button', { name: 'Cancel' }).click();
	await inspect.getByRole('button', { name: 'More image actions' }).click();
	await expect(page.locator('section[aria-label="Generated Atlas tag suggestions"]')).toHaveCount(
		0
	);
	expect(createRequests).toBe(0);

	await inspect.getByRole('button', { name: 'Generate tags' }).click();
	const suggestions = page.locator('section[aria-label="Generated Atlas tag suggestions"]');
	await expect(suggestions).toBeVisible();
	expect(createRequests).toBe(1);
	await expect(suggestions.getByText(/123 run/)).toBeVisible();

	const toggle = suggestions.getByRole('button', { name: /Tag suggestions/ });
	await toggle.click();
	await expect(suggestions.getByRole('button', { name: /Add selected/ })).toBeHidden();
	await toggle.click();

	await suggestions.getByRole('checkbox', { name: 'Select dragon' }).check();
	await suggestions.getByRole('checkbox', { name: 'Select wings' }).check();
	await expect(suggestions.getByText('2 selected')).toBeVisible();
	const scrollBefore = await page.locator('.main-scroll').evaluate((element) => element.scrollTop);
	await suggestions.getByRole('button', { name: 'Add selected (2)' }).click();
	await expect.poll(() => appliedSelections.length).toBe(2);
	await expect
		.poll(() => page.locator('.main-scroll').evaluate((element) => element.scrollTop))
		.toBeCloseTo(scrollBefore, -1);

	await inspect.getByRole('button', { name: 'Back to Atlas' }).click();
	await expect(page.getByRole('region', { name: 'Atlas home' })).toBeVisible();
	await page.getByRole('button', { name: 'Open Atlas inspect for Crimson Horizon' }).click();
	await primary.getByRole('button', { name: 'Library' }).click();
	await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible();

	await page.setViewportSize({ width: 390, height: 844 });
	const mobilePrimary = page.getByRole('navigation', { name: 'Mobile primary' });
	await mobilePrimary.getByRole('button', { name: 'Atlas', exact: true }).click();
	await page.getByRole('button', { name: 'Open Atlas inspect for Crimson Horizon' }).click();
	await page.getByRole('button', { name: 'Generate tags' }).click();
	const mobileSuggestions = page.locator('section[aria-label="Generated Atlas tag suggestions"]');
	await expect(mobileSuggestions).toBeVisible();
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
		.toBe(true);
	const mobilePanelHeight = await mobileSuggestions.evaluate(
		(element) => element.getBoundingClientRect().height
	);
	expect(mobilePanelHeight).toBeLessThan(540);
	await mobileSuggestions.getByRole('button', { name: /Tag suggestions/ }).click();
	await expect(mobileSuggestions.getByRole('button', { name: /Add selected/ })).toBeHidden();
});

test('wikidata cooldown renders a stable message', async ({ page }) => {
	await page.route('**/explore/api/departments**', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ departments: [] })
		});
	});
	await page.route('**/explore/api/wikidata/entities**', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				entities: [{ id: 'Q7559', label: 'dragon', description: 'legendary creature' }]
			})
		});
	});
	await page.route('**/explore/api/search', async (route) => {
		const body = route.request().postDataJSON() as { source?: string };
		if (body.source === 'wikidata') {
			await route.fulfill({
				status: 503,
				headers: { 'retry-after': '15' },
				contentType: 'application/json',
				body: JSON.stringify({
					error: 'Wikidata is taking a breather. Try again in a moment.',
					retryAfterSeconds: 15
				})
			});
			return;
		}
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ items: [metResult], total: 1, nextCursor: null })
		});
	});

	await page.goto('/');
	await page
		.getByRole('navigation', { name: 'Primary' })
		.getByRole('button', { name: 'Explore' })
		.click();
	await page.getByRole('button', { name: 'Wikimedia' }).click();
	const subjectSearch = page.getByRole('textbox', { name: 'Search Explore' });
	await subjectSearch.fill('dragon');
	await page.getByRole('option', { name: /dragon legendary creature/ }).click();

	await expect(
		page.getByText('Wikidata is taking a breather. Try again in a moment.')
	).toBeVisible();
	await expect(page.locator('.skeleton')).toHaveCount(0);
});

test('wikidata pagination waits for the normal load threshold', async ({ page }) => {
	const wikidataRequests: Array<{ cursor?: string }> = [];
	await page.route('**/explore/api/departments**', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ departments: [] })
		});
	});
	await page.route('**/explore/api/wikidata/entities**', async (route) => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				entities: [
					{
						id: 'Q7559',
						label: 'dragon',
						description: 'legendary winged, fire-breathing reptile'
					}
				]
			})
		});
	});
	await page.route('**/explore/api/search', async (route) => {
		const body = route.request().postDataJSON() as {
			source?: string;
			query?: { cursor?: string; depicts?: Array<{ id: string }> };
		};
		if (body.source === 'wikidata') {
			const request = body.query ?? {};
			wikidataRequests.push({ cursor: request.cursor });
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					items: request.cursor
						? [createWikidataResult(41)]
						: Array.from({ length: 40 }, (_, index) => createWikidataResult(index + 1)),
					total: null,
					nextCursor: request.cursor ? null : '40'
				})
			});
			return;
		}
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({ items: [metResult], total: 1, nextCursor: null })
		});
	});

	await page.goto('/');
	await page
		.getByRole('navigation', { name: 'Primary' })
		.getByRole('button', { name: 'Explore' })
		.click();
	await page.getByRole('button', { name: 'Wikimedia' }).click();
	const subjectSearch = page.getByRole('textbox', { name: 'Search Explore' });
	await subjectSearch.fill('dragon');
	await page.getByRole('option', { name: /dragon legendary winged/ }).click();
	await expect(
		page.getByRole('button', { name: 'Inspect Wikidata Dragon Study 1', exact: true })
	).toBeVisible();
	await page.waitForTimeout(500);
	expect(wikidataRequests.filter((request) => request.cursor === '40')).toHaveLength(0);

	await page.locator('.scroll-area').evaluate((node) => {
		node.scrollTop = node.scrollHeight;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(
		page.getByRole('button', { name: 'Inspect Wikidata Dragon Study 41', exact: true })
	).toBeVisible();
	expect(wikidataRequests.filter((request) => request.cursor === '40')).toHaveLength(1);
});

test('tablet library and Atlas avoid horizontal overflow', async ({ page }) => {
	await page.setViewportSize({ width: 820, height: 1180 });
	await page.goto('/');

	const primary = page.getByRole('navigation', { name: 'Primary' });
	await primary.getByRole('button', { name: 'Library', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'All images' })).toBeVisible();
	await expect(page.getByRole('searchbox', { name: 'Search images' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Folders', exact: true })).toBeVisible();
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
		.toBe(true);

	await page.getByRole('button', { name: 'Folders', exact: true }).click();
	const tabletFolderDrawer = page.getByRole('complementary', { name: 'Library folders' });
	await expect(tabletFolderDrawer).toBeVisible();
	await tabletFolderDrawer.getByRole('button', { name: /^refs / }).click();
	await expect(page.getByRole('heading', { name: 'refs' })).toBeVisible();
	await page.getByRole('button', { name: /artworks/ }).click();
	await expect(page.getByRole('heading', { name: 'artworks' })).toBeVisible();
	await expect(
		page.getByLabel('Folder path').getByRole('button', { name: 'Library', exact: true })
	).toBeVisible();
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
		.toBe(true);

	await primary.getByRole('button', { name: 'Atlas', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Atlas home' })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Atlas search' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Build a search' })).toBeVisible();
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
		.toBe(true);
});

test('phone browse opens inspect and add sheet', async ({ page }) => {
	await mockExploreApi(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');

	await expect(page.getByPlaceholder('Search artworks, tags, creators, colors...')).toBeHidden();

	const mobilePrimary = page.getByRole('navigation', { name: 'Mobile primary' });
	await mobilePrimary.getByRole('button', { name: 'Library', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'All images' })).toBeVisible();
	await expect(page.getByRole('searchbox', { name: 'Search images' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Folders', exact: true })).toBeVisible();
	await expect(page.getByLabel('Current location')).toBeHidden();
	await page.getByRole('button', { name: 'Home' }).click();
	await expect(page.getByRole('searchbox', { name: 'Search images' })).toBeHidden();
	await mobilePrimary.getByRole('button', { name: 'Library', exact: true }).click();
	await expect(page.getByRole('searchbox', { name: 'Search images' })).toBeVisible();
	await page.locator('#main-content').evaluate((node) => {
		node.scrollTop = 140;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(page.getByLabel('Current location')).toBeHidden();
	await expect(page.getByRole('searchbox', { name: 'Search images' })).toBeVisible();
	await expect(page.getByRole('banner').getByRole('button', { name: 'Home' })).toBeVisible();
	await page.locator('#main-content').evaluate((node) => {
		node.scrollTop = 0;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(mobilePrimary).toHaveAttribute('aria-hidden', 'false');

	await mobilePrimary.getByRole('button', { name: 'Explore', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Explore', exact: true })).toBeVisible();
	await expect(page.getByPlaceholder('Search artwork, artists, or collections...')).toBeVisible();
	await expect(page.locator('.source-header')).toHaveCount(0);
	await expect(page.locator('.topbar')).toHaveCount(0);
	await page.locator('#main-content').evaluate((node) => {
		node.scrollTop = 0;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
		node.scrollTop = 140;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(page.locator('.bottom-nav')).toHaveAttribute('aria-hidden', 'true');
	await page.locator('#main-content').evaluate((node) => {
		node.scrollTop = 100;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(page.locator('.bottom-nav')).toHaveAttribute('aria-hidden', 'false');
	await page.locator('#main-content').evaluate((node) => {
		node.scrollTop = 0;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	const sourceSwitcher = page.getByLabel('Explore sources');
	await expect
		.poll(() =>
			sourceSwitcher.evaluate((node) => {
				const style = getComputedStyle(node);
				return {
					overflowing: node.scrollWidth > node.clientWidth,
					touchAction: style.touchAction,
					overscrollInline: style.overscrollBehaviorInline
				};
			})
		)
		.toEqual({
			overflowing: true,
			touchAction: 'pan-x',
			overscrollInline: 'contain'
		});
	await sourceSwitcher.evaluate((node) => {
		node.scrollLeft = 120;
	});
	await expect.poll(() => sourceSwitcher.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
	await page.getByRole('button', { name: 'Wikimedia' }).click();
	await expect(page.getByRole('textbox', { name: 'Search Wikimedia' })).toBeVisible();
	await expect(page.getByLabel('Artwork search mode')).toBeVisible();
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
		.toBe(true);
	await page.getByRole('button', { name: 'The Met', exact: true }).click();
	await expect(page.getByLabel('Current location')).toBeHidden();
	await expect(
		page.getByRole('button', { name: 'Inspect Wheat Field with Cypresses' })
	).toBeVisible();
	await page.getByRole('button', { name: 'Inspect Wheat Field with Cypresses' }).click();
	await expect(page.getByRole('heading', { name: 'Wheat Field with Cypresses' })).toBeVisible();
	await expect(
		page
			.getByRole('complementary', { name: 'Explore detail' })
			.getByRole('button', { name: 'Save original' })
	).toBeEnabled();
	await page
		.getByRole('button', { name: 'Open focused preview for Wheat Field with Cypresses' })
		.click();
	await expect(page.getByRole('dialog', { name: 'Focused art preview' })).toBeVisible();
	await page.getByRole('button', { name: 'Close focused preview' }).first().click();
	await page.getByRole('button', { name: 'Back to Explore results' }).click();

	await mobilePrimary.getByRole('button', { name: 'Library', exact: true }).click();
	await page.getByRole('button', { name: 'Folders', exact: true }).click();
	await page
		.getByRole('complementary', { name: 'Library folders' })
		.getByRole('button', { name: /Recently Added/ })
		.click();
	await expect(page.getByRole('heading', { name: 'Recently Added' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Inspect Crimson Horizon' })).toBeVisible();

	await mobilePrimary.getByRole('button', { name: 'Library', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'All images' })).toBeVisible();
	await page.getByRole('button', { name: 'Folders', exact: true }).click();
	await page
		.getByRole('complementary', { name: 'Library folders' })
		.getByRole('button', { name: /^refs / })
		.click();
	await expect(page.getByRole('heading', { name: 'refs' })).toBeVisible();
	await page.getByRole('button', { name: /artworks/ }).click();
	await expect(page.getByRole('heading', { name: 'artworks' })).toBeVisible();
	await expect(
		page.getByLabel('Folder path').getByRole('button', { name: 'Library', exact: true })
	).toBeVisible();
	await expect(page.getByRole('button', { name: /impressionism/ })).toBeVisible();

	await page.getByRole('button', { name: 'Open filters', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
	await page
		.getByRole('dialog', { name: 'Filters' })
		.getByRole('button', { name: 'Close filters' })
		.click();
	await expect(page.getByRole('dialog', { name: 'Filters' })).toBeHidden();

	await mobilePrimary.getByRole('button', { name: 'Library', exact: true }).click();
	await page.getByRole('button', { name: 'Folders', exact: true }).click();
	await page
		.getByRole('complementary', { name: 'Library folders' })
		.getByRole('button', { name: /Recently Added/ })
		.click();
	await page.getByRole('button', { name: 'Inspect Crimson Horizon' }).click();
	await expect(page.getByRole('heading', { name: 'Crimson Horizon', level: 1 })).toBeVisible();
	await expect(page.getByText('1 / 1')).toBeHidden();
	await page.getByRole('button', { name: 'Back to browsing' }).click();
	await expect(page.getByRole('button', { name: 'Inspect Crimson Horizon' })).toBeVisible();

	await mobilePrimary.getByRole('button', { name: 'Atlas', exact: true }).click();
	const atlasHome = page.getByRole('region', { name: 'Atlas home' });
	await expect(atlasHome).toBeVisible();
	await atlasHome.evaluate((node) => {
		node.scrollTop = 0;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
		node.scrollTop = 140;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(page.locator('.bottom-nav')).toHaveAttribute('aria-hidden', 'true');
	await atlasHome.evaluate((node) => {
		node.scrollTop = 100;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(page.locator('.bottom-nav')).toHaveAttribute('aria-hidden', 'false');
	await atlasHome.evaluate((node) => {
		node.scrollTop = 0;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await page.getByRole('button', { name: 'Open Atlas inspect for Crimson Horizon' }).click();
	await expect(page.getByRole('region', { name: /Atlas inspect Crimson Horizon/ })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Generate tags' })).toBeVisible();
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
		.toBe(true);

	await page.getByRole('button', { name: 'Back to Atlas results' }).click();
	await mobilePrimary.getByRole('button', { name: 'Add to Library' }).click();
	await expect(page.getByRole('heading', { name: 'Add to Library' })).toBeVisible();
	await expect(page.getByRole('button', { name: /From URL/ })).toBeVisible();
});
