import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type LibraryPaths = {
	root: string;
	database: string;
	originals: string;
	thumbnails: string;
	imports: string;
	lazyDownloads: string;
	palettesCache: string;
	exports: string;
};

export function resolveLibraryPaths(): LibraryPaths {
	const root = resolve(process.env.PASTICHE_LIBRARY_DIR ?? join(process.cwd(), '.pastiche'));
	return {
		root,
		database: join(root, 'workspace.sqlite'),
		originals: join(root, 'originals'),
		thumbnails: join(root, 'thumbnails'),
		imports: join(root, 'imports'),
		lazyDownloads: join(root, 'lazy-downloads'),
		palettesCache: join(root, 'palettes-cache'),
		exports: join(root, 'exports')
	};
}

export function ensureLibraryArchive(paths = resolveLibraryPaths()) {
	for (const directory of [
		paths.root,
		paths.originals,
		paths.thumbnails,
		paths.imports,
		paths.lazyDownloads,
		paths.palettesCache,
		paths.exports
	]) {
		mkdirSync(directory, { recursive: true });
	}
	return paths;
}
