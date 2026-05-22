import { expect, test } from '@playwright/test';

test('desktop library and explore surfaces are navigable', async ({ page }) => {
	await page.goto('/');

	const primary = page.getByRole('navigation', { name: 'Primary' });
	await primary.getByRole('button', { name: 'Library' }).click();
	await expect(page.getByRole('button', { name: 'Inspect Crimson Horizon' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Crimson Horizon' })).toBeVisible();

	await page.getByPlaceholder('Search artwork, artists, or collections...').fill('mondrian');
	await expect(page.getByRole('button', { name: 'Inspect Primary Blocks' })).toBeVisible();

	await page.getByPlaceholder('Search artwork, artists, or collections...').fill('');
	await primary.getByRole('button', { name: 'Explore' }).click();
	await expect(page.getByRole('button', { name: 'Inspect Coastal Village Afternoon' })).toBeVisible();
	await page.getByRole('banner').getByRole('button', { name: 'Add to Library' }).click();
	await expect(page.getByRole('heading', { name: 'Add to Library' })).toBeVisible();
	await expect(page.getByRole('button', { name: /From Gallery/ })).toBeVisible();
});

test('phone browse opens inspect and add sheet', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');

	const mobilePrimary = page.getByRole('navigation', { name: 'Mobile primary' });
	await mobilePrimary.getByRole('button', { name: 'Library', exact: true }).click();

	await page.getByRole('button', { name: 'Inspect Crimson Horizon' }).click();
	await expect(page.getByRole('heading', { name: 'Crimson Horizon', level: 1 })).toBeVisible();
	await page.getByRole('button', { name: 'Back to browsing' }).click();
	await expect(page.getByRole('button', { name: 'Inspect Crimson Horizon' })).toBeVisible();

	await mobilePrimary.getByRole('button', { name: 'Add to Library' }).click();
	await expect(page.getByRole('heading', { name: 'Add to Library' })).toBeVisible();
	await expect(page.getByRole('button', { name: /From URL/ })).toBeVisible();
});
