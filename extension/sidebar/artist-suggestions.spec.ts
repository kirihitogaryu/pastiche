import { describe, expect, it } from 'vitest';
import { metadataPatchForArtistSuggestion } from './artist-suggestions';

describe('artist suggestion helpers', () => {
	it('turns a selected artist suggestion into an import metadata patch', () => {
		expect.assertions(1);

		expect(
			metadataPatchForArtistSuggestion({
				kind: 'artist',
				slug: 'damonwildfire',
				label: 'DamonWildFire',
				match: 'Damon W. Fire',
				matchReason: 'alias',
				workCount: 12,
				aliases: [],
				links: [
					{
						url: 'https://deviantart.com/damonwildfire',
						host: 'deviantart.com',
						username: 'damonwildfire',
						sourceLabel: 'DeviantArt',
						confidence: 'high'
					}
				]
			})
		).toEqual({
			artist: 'DamonWildFire',
			artistProfileUrl: 'https://deviantart.com/damonwildfire',
			artistUsername: 'damonwildfire'
		});
	});
});
