export function downloadLibraryAsset(assetId: string, title: string) {
	const link = document.createElement('a');
	link.href = `/api/library/assets/${encodeURIComponent(assetId)}/image?variant=original&download=1`;
	link.download = safeDownloadName(title || assetId);
	document.body.append(link);
	link.click();
	link.remove();
}

function safeDownloadName(value: string) {
	return (
		value
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
			.replace(/\s+/g, ' ')
			.trim() || 'pastiche-reference'
	);
}
