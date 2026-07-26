import { buildAtlasVocabularyExport, vocabularyExportToMarkdown } from '$lib/server/atlas/export';
import { applyAtlasWikiSeed } from '$lib/server/atlas/wiki';
import { openLibraryDatabase } from '$lib/server/library/schema';

export function GET({ url }: { url: URL }) {
	const format = url.searchParams.get('format') === 'markdown' ? 'markdown' : 'json';
	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		const exportData = buildAtlasVocabularyExport(db);
		if (format === 'markdown') {
			return new Response(vocabularyExportToMarkdown(exportData), {
				headers: {
					'content-type': 'text/markdown; charset=utf-8'
				}
			});
		}
		return Response.json(exportData);
	} finally {
		db.close();
	}
}
