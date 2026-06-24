import { describe, expect, it } from 'vitest';
import { listAtlasWikiDocs, readAtlasWikiDoc } from './wikiDocs';

describe('Atlas wiki docs', () => {
	it('lists allowlisted documentation pages', () => {
		const docs = listAtlasWikiDocs();

		expect(docs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ slug: 'contribution-guidelines' }),
				expect.objectContaining({ slug: 'tagging-rules' }),
				expect.objectContaining({ slug: 'ai-agent-tagging-rules' })
			])
		);
	});

	it('reads allowlisted documentation from the Atlas wiki docs folder', () => {
		const doc = readAtlasWikiDoc('tagging-rules');

		expect(doc).toMatchObject({
			slug: 'tagging-rules',
			title: 'Tagging Rules'
		});
		expect(doc?.markdown).toContain('# Tagging Rules');
	});

	it('rejects non-allowlisted documentation slugs', () => {
		expect(readAtlasWikiDoc('../README')).toBeNull();
		expect(readAtlasWikiDoc('missing')).toBeNull();
	});
});
