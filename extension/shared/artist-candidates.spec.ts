// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
	automaticallySelectedArtistCandidate,
	artistCandidatesForPage,
	normalizeArtistCandidates
} from './artist-candidates';

describe('artist candidate helpers', () => {
	it('auto-selects only a single high-confidence identity', () => {
		expect.assertions(2);
		const candidate = {
			label: 'Example Artist',
			username: 'example_artist',
			profileUrl: 'https://example.com/example_artist',
			confidence: 'high' as const,
			reason: 'Credits near image'
		};

		expect(automaticallySelectedArtistCandidate([candidate])).toEqual(candidate);
		expect(
			automaticallySelectedArtistCandidate([
				candidate,
				{
					...candidate,
					label: 'Second Artist',
					username: 'second_artist',
					profileUrl: 'https://example.com/second_artist'
				}
			])
		).toBeNull();
	});

	it('sanitizes persisted candidates and deduplicates profile identities', () => {
		expect.assertions(1);
		expect(
			normalizeArtistCandidates([
				{
					label: ' Example Artist ',
					username: '@example_artist',
					profileUrl: 'https://example.com/example_artist',
					confidence: 'high',
					reason: ' Credits near image '
				},
				{
					label: 'Duplicate',
					username: 'example_artist',
					profileUrl: null,
					confidence: 'medium',
					reason: 'Page author'
				},
				{ label: '', confidence: 'high', reason: 'Invalid' }
			])
		).toEqual([
			{
				label: 'Example Artist',
				username: 'example_artist',
				profileUrl: 'https://example.com/example_artist',
				confidence: 'high',
				reason: 'Credits near image'
			}
		]);
	});

	it('prefers the Fur Affinity original media owner over the signed-in account', () => {
		document.body.innerHTML = `
			<main id="page-submission">
				<a href="/user/viewer_account/">Viewer Account</a>
				<a href="https://d.furaffinity.net/art/actual_artist/12345/work.png">
					<img src="https://t.furaffinity.net/12345@400-1.jpg">
				</a>
			</main>
		`;

		expect(
			artistCandidatesForPage(document, {
				pageUrl: 'https://www.furaffinity.net/view/12345/',
				targetElement: document.querySelector('img')
			})[0]
		).toMatchObject({
			label: 'actual_artist',
			username: 'actual_artist',
			profileUrl: 'https://www.furaffinity.net/user/actual_artist/',
			confidence: 'high'
		});
	});
});
