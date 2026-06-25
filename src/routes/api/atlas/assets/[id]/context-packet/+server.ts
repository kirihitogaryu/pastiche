import {
	assetContextExportToMarkdown,
	buildAtlasAssetContextExport,
	buildAtlasVocabularyExport
} from '$lib/server/atlas/export';
import { applyAtlasWikiSeed } from '$lib/server/atlas/wiki';
import { openLibraryDatabase } from '$lib/server/library/schema';

export function GET({ params, url }: { params: { id: string }; url: URL }) {
	const format = url.searchParams.get('format') === 'markdown' ? 'markdown' : 'json';
	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		const vocabulary = buildAtlasVocabularyExport(db);
		const exportData = buildAtlasAssetContextExport(params.id, vocabulary);
		if (!exportData) {
			return Response.json({ error: 'Asset not found' }, { status: 404 });
		}
		if (format === 'markdown') {
			return new Response(assetContextExportToMarkdown(exportData), {
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
