import { expect, test } from '@playwright/test';

test('desktop library and explore surfaces are navigable', async ({ page }) => {
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
		page.getByRole('button', { name: 'Inspect Coastal Village Afternoon' })
	).toBeVisible();
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
	await page.locator('.scroll-area').evaluate((node) => {
		node.scrollTop = 0;
		node.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await page.getByRole('button', { name: 'Close inspector' }).click();
	await page.getByRole('button', { name: 'Inspect Coastal Village Afternoon' }).click();
	await expect(page.getByRole('heading', { name: 'Coastal Village Afternoon' })).toBeVisible();
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

test('phone browse opens inspect and add sheet', async ({ page }) => {
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
