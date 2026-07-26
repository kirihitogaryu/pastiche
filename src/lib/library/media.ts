export function isGifMedia(mimeType: string | null | undefined, ...values: unknown[]) {
	if (mimeType?.toLowerCase() === 'image/gif') return true;
	return values.some((value) => typeof value === 'string' && /\.gif(?:$|[?#])/i.test(value.trim()));
}
