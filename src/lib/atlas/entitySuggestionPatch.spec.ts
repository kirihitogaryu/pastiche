import { describe, expect, it } from 'vitest';
import { atlasEntityPatchForSuggestion } from './entitySuggestionPatch';

describe('Atlas entity suggestion patches', () => {
	it('creates the normal source-entity patch for a selected artist suggestion', () => {
		expect.assertions(1);

		expect(
			atlasEntityPatchForSuggestion({
				kind: 'artist',
				slug: 'exampleartist',
				label: 'ExampleArtist',
				match: 'Example Artist',
				matchReason: 'alias',
				workCount: 4,
				aliases: [],
				links: []
			})
		).toEqual({ entities: [{ kind: 'artist', label: 'ExampleArtist' }] });
	});
});
