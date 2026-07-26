import { describe, expect, it, vi } from 'vitest';
import { ServerCache } from '../server-cache';
import {
	buildBlueskyAuthorFeedUrl,
	buildBlueskyTagSearchUrl,
	createBlueskyConnector,
	normalizeBlueskyPost
} from './bluesky';

const post = {
	uri: 'at://did:plc:test/app.bsky.feed.post/3abc',
	cid: 'bafy-test',
	author: {
		did: 'did:plc:test',
		handle: 'artist.example',
		displayName: 'Test Artist'
	},
	record: {
		text: 'Dragon studies #dragon',
		createdAt: '2026-07-24T12:00:00.000Z',
		tags: ['characterart']
	},
	embed: {
		$type: 'app.bsky.embed.images#view',
		images: [
			{
				thumb: 'https://cdn.bsky.app/thumb-1.jpg',
				fullsize: 'https://cdn.bsky.app/full-1.jpg',
				alt: 'A dragon',
				aspectRatio: { width: 1200, height: 900 }
			},
			{
				thumb: 'https://cdn.bsky.app/thumb-2.jpg',
				fullsize: 'https://cdn.bsky.app/full-2.jpg',
				alt: 'Another dragon',
				aspectRatio: { width: 900, height: 1200 }
			}
		]
	},
	labels: [{ val: 'suggestive' }],
	likeCount: 12
};

describe('Bluesky connector helpers', () => {
	it('normalizes one post as one result with selectable additional images', () => {
		expect(normalizeBlueskyPost(post)).toMatchObject({
			source: 'bluesky',
			title: 'Dragon studies #dragon',
			artistRaw: 'Test Artist',
			imageUrl: 'https://cdn.bsky.app/full-1.jpg',
			additionalImages: ['https://cdn.bsky.app/full-2.jpg'],
			contentRating: 'questionable',
			tags: ['characterart', 'dragon'],
			rawMetadata: {
				bluesky: {
					authorHandle: 'artist.example',
					imageCount: 2,
					width: 1200,
					height: 900
				}
			}
		});
	});

	it('builds public artist and tag requests with native cursors', () => {
		const artist = buildBlueskyAuthorFeedUrl('artist.example', {
			artist: 'artist.example',
			cursor: 'next',
			limit: 40
		});
		expect(artist.pathname).toBe('/xrpc/app.bsky.feed.getAuthorFeed');
		expect(artist.searchParams.get('filter')).toBe('posts_with_media');
		expect(artist.searchParams.get('cursor')).toBe('next');

		const tags = buildBlueskyTagSearchUrl('#dragon, #art', {
			tag: '#dragon, #art',
			limit: 40
		});
		expect(tags.pathname).toBe('/xrpc/app.bsky.feed.searchPosts');
		expect(tags.searchParams.getAll('tag')).toEqual(['dragon', 'art']);
	});
});

describe('Bluesky connector', () => {
	it('uses the public AppView, skips reposts and replies, and filters hidden sensitive work', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			expect(String(input)).toContain('public.api.bsky.app');
			expect((init?.headers as Record<string, string>)['user-agent']).toContain('Pastiche');
			return Response.json({
				feed: [
					{ post },
					{ post, reason: { $type: 'app.bsky.feed.defs#reasonRepost' } },
					{ post, reply: { root: {}, parent: {} } }
				],
				cursor: 'next'
			});
		});
		const connector = createBlueskyConnector({
			fetch: fetchMock,
			cache: new ServerCache(),
			requestsPerSecond: 1000
		});

		await expect(
			connector.search({ artist: '@artist.example', contentSafety: 'show', limit: 40 })
		).resolves.toMatchObject({ items: [{ source: 'bluesky' }], nextCursor: 'next' });
		await expect(
			connector.search({ artist: '@artist.example', contentSafety: 'hide', limit: 40 })
		).resolves.toMatchObject({ items: [] });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
