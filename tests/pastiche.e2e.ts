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

async function mockExploreApi(page: import('@playwright/test').Page) {
	let secondPageAttempts = 0;
	const searchRequests: Array<{
		source?: string;
		cursor?: string;
		keyword?: string;
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
				tag?: string;
				wikidataMode?: string;
				wikidataEntities?: Array<{ id: string; label: string; description: string | null }>;
				depicts?: Array<{ id: string; label: string; description: string | null }>;
			};
			cursor?: string;
			keyword?: string;
			tag?: string;
		};
		const source = body.source ?? 'met';
		const request = { ...(body.query ?? body), source } as (typeof searchRequests)[number];
		searchRequests.push(request);
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

test('desktop library and explore surfaces are navigable', async ({ page }) => {
	const exploreApi = await mockExploreApi(page);
	await page.goto('/');

	const primary = page.getByRole('navigation', { name: 'Primary' });
	await primary.getByRole('button', { name: 'Library' }).click();
	await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
	await expect(page.getByRole('button', { name: /View Full Library/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Pinned Projects' })).toBeVisible();
	await page.getByRole('banner').getByRole('button', { name: 'Filter' }).click();
	await expect(page.getByRole('complementary', { name: 'Filters' })).toBeVisible();
	await page
		.getByRole('complementary', { name: 'Filters' })
		.getByRole('button', { name: 'Close filters' })
		.click();
	await page.getByRole('button', { name: /View Full Library/ }).click();
	await expect(page.getByRole('heading', { name: 'All Library' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Inspect Crimson Horizon' })).toBeVisible();
	await page.getByRole('button', { name: 'Inspect Crimson Horizon' }).click();
	await expect(page.getByRole('heading', { name: 'Crimson Horizon' })).toBeVisible();
	await expect(page.getByRole('complementary', { name: 'Image inspector' })).toBeVisible();
	await page.getByRole('button', { name: 'Crimson Horizon actions' }).click();
	await expect(page.getByRole('menu', { name: 'Crimson Horizon actions' })).toBeVisible();

	await page.getByPlaceholder('Search artwork, artists, or collections...').fill('mondrian');

	await page.getByPlaceholder('Search artwork, artists, or collections...').fill('');
	await primary.getByRole('button', { name: 'Explore' }).click();
	await expect(
		page.getByRole('heading', { name: 'Explore public-domain museum references' })
	).toBeVisible();
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
	await page.getByRole('banner').getByRole('button', { name: 'Filter' }).click();
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
	await expect(page.getByRole('heading', { name: 'Search Wikimedia artworks' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Depicts' })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('button', { name: 'Main subject' })).toBeVisible();
	await expect(page.getByLabel('Search depicted subjects')).toHaveCount(0);
	const subjectSearch = page.getByRole('textbox', { name: 'Search Explore' });
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
	await expect(page.getByRole('button', { name: 'Inspect related work Dragon Pendant' })).toBeVisible();
	await page
		.getByRole('button', { name: 'Open all works related to Saint George and the Dragon' })
		.click();
	await expect(page.getByRole('heading', { name: 'Similar works from Wikidata' })).toBeVisible();
	await expect(page.getByText('Similar to Saint George and the Dragon')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Inspect Dragon Pendant' })).toBeVisible();
	expect(
		exploreApi.searchRequests.some(
			(request) => request.source === 'wikidata' && request.wikidataMode === 'depicts'
		)
	).toBe(true);
	await page.getByRole('button', { name: 'Return to subject search' }).click();
	await page.getByRole('button', { name: 'Main subject' }).click();
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
	await page.getByRole('button', { name: 'Title' }).click();
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
	await page.getByRole('button', { name: 'The Met', exact: true }).click();
	await expect(page.getByRole('button', { name: /Add .* to library/i })).toHaveCount(0);
	await expect(page.getByRole('complementary', { name: 'Explore detail' })).toHaveCount(0);
	await page.locator('.scroll-area').evaluate((node) => {
		node.scrollTop = 120;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(page.getByText('Search by:')).toBeHidden();
	await expect(
		page.getByRole('banner').getByRole('button', { name: 'Pastiche Home' })
	).toBeVisible();
	await expect(
		page.getByRole('banner').getByRole('button', { name: 'Add to Library' })
	).toBeVisible();
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
		page.getByRole('button', { name: 'Storage needed for Add to Library' })
	).toBeDisabled();
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
	await expect(
		page.getByRole('banner').getByRole('button', { name: 'Add to Library' })
	).toBeVisible();
	await page.getByRole('banner').getByRole('button', { name: 'Add to Library' }).click();
	await expect(page.getByRole('heading', { name: 'Add to Library' })).toBeVisible();
	await expect(page.getByRole('button', { name: /From Gallery/ })).toBeVisible();
});

test('wikidata cooldown renders a stable message', async ({ page }) => {
	await page.route('**/explore/api/departments**', async (route) => {
		await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ departments: [] }) });
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
	await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Explore' }).click();
	await page.getByRole('button', { name: 'Wikimedia' }).click();
	const subjectSearch = page.getByRole('textbox', { name: 'Search Explore' });
	await subjectSearch.fill('dragon');
	await page.getByRole('option', { name: /dragon legendary creature/ }).click();

	await expect(page.getByText('Wikidata is taking a breather. Try again in a moment.')).toBeVisible();
	await expect(page.locator('.skeleton')).toHaveCount(0);
});

test('wikidata pagination waits for the normal load threshold', async ({ page }) => {
	const wikidataRequests: Array<{ cursor?: string }> = [];
	await page.route('**/explore/api/departments**', async (route) => {
		await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ departments: [] }) });
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
	await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Explore' }).click();
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

test('phone browse opens inspect and add sheet', async ({ page }) => {
	await mockExploreApi(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');

	await expect(page.getByPlaceholder('Search artworks, tags, creators, colors...')).toBeHidden();

	const mobilePrimary = page.getByRole('navigation', { name: 'Mobile primary' });
	await mobilePrimary.getByRole('button', { name: 'Library', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
	await expect(page.getByRole('button', { name: /View Full Library/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Pinned Projects' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Top-level folders' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Smart folders' })).toBeVisible();
	await expect(page.getByLabel('Current location')).toBeHidden();
	await page.getByRole('button', { name: 'Home' }).click();
	await expect(page.getByPlaceholder('Search images, projects, folders, tags...')).toBeHidden();
	await mobilePrimary.getByRole('button', { name: 'Library', exact: true }).click();
	await expect(page.getByPlaceholder('Search images, projects, folders, tags...')).toBeVisible();
	await page.locator('#main-content').evaluate((node) => {
		node.scrollTop = 140;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(page.getByLabel('Current location')).toBeHidden();
	await expect(page.getByPlaceholder('Search images, projects, folders, tags...')).toBeVisible();
	await expect(page.getByRole('banner').getByRole('button', { name: 'Home' })).toBeVisible();
	await page.locator('#main-content').evaluate((node) => {
		node.scrollTop = 0;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});

	await mobilePrimary.getByRole('button', { name: 'Explore', exact: true }).click();
	await expect(page.getByPlaceholder('Search artworks, collections, artists...')).toBeVisible();
	await expect(page.getByLabel('Current location')).toBeHidden();
	await expect(
		page.getByRole('button', { name: 'Inspect Wheat Field with Cypresses' })
	).toBeVisible();
	await page.getByRole('button', { name: 'Inspect Wheat Field with Cypresses' }).click();
	await expect(page.getByRole('heading', { name: 'Wheat Field with Cypresses' })).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Storage needed for Add to Library' })
	).toBeDisabled();
	await page
		.getByRole('button', { name: 'Open focused preview for Wheat Field with Cypresses' })
		.click();
	await expect(page.getByRole('dialog', { name: 'Focused art preview' })).toBeVisible();
	await page.getByRole('button', { name: 'Close focused preview' }).first().click();
	await page.getByRole('button', { name: 'Back to Explore results' }).click();

	await mobilePrimary.getByRole('button', { name: 'Library', exact: true }).click();

	await page.getByRole('button', { name: /View Full Library/ }).click();
	await expect(page.getByRole('heading', { name: 'All Library' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Inspect Crimson Horizon' })).toBeVisible();

	await mobilePrimary.getByRole('button', { name: 'Library', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
	await page
		.getByRole('navigation', { name: 'Top-level folders' })
		.getByRole('button', { name: /refs/ })
		.click();
	await expect(page.getByRole('heading', { name: 'refs' })).toBeVisible();
	await page.getByRole('button', { name: /artworks/ }).click();
	await expect(page.getByRole('heading', { name: 'artworks' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Library breadcrumb' })).toBeVisible();
	await expect(page.getByLabel('Subfolders')).toBeVisible();

	await page.getByRole('button', { name: 'Filter', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
	await page
		.getByRole('dialog', { name: 'Filters' })
		.getByRole('button', { name: 'Close filters' })
		.click();
	await expect(page.getByRole('dialog', { name: 'Filters' })).toBeHidden();

	await mobilePrimary.getByRole('button', { name: 'Library', exact: true }).click();
	await page.getByRole('button', { name: /View Full Library/ }).click();
	await page.getByRole('button', { name: 'Inspect Crimson Horizon' }).click();
	await expect(page.getByRole('heading', { name: 'Crimson Horizon', level: 1 })).toBeVisible();
	await expect(page.getByText('1 / 1')).toBeHidden();
	await page.getByRole('button', { name: 'Back to browsing' }).click();
	await expect(page.getByRole('button', { name: 'Inspect Crimson Horizon' })).toBeVisible();

	await mobilePrimary.getByRole('button', { name: 'Add to Library' }).click();
	await expect(page.getByRole('heading', { name: 'Add to Library' })).toBeVisible();
	await expect(page.getByRole('button', { name: /From URL/ })).toBeVisible();
});
