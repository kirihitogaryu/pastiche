import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

export type EmbeddedImageMetadata = {
	kind: 'png' | 'unknown';
	pngText: Record<string, string>;
	warnings: string[];
};

export async function extractEmbeddedImageMetadata(
	input: Buffer | Uint8Array | string
): Promise<EmbeddedImageMetadata> {
	try {
		const buffer = typeof input === 'string' ? await readFile(input) : Buffer.from(input);
		if (!isPng(buffer)) {
			return {
				kind: 'unknown',
				pngText: {},
				warnings: ['Image is not a PNG file.']
			};
		}

		return {
			kind: 'png',
			pngText: extractPngTextChunks(buffer),
			warnings: []
		};
	} catch (error) {
		return {
			kind: 'unknown',
			pngText: {},
			warnings: [
				error instanceof Error ? error.message : 'Could not read embedded image metadata.'
			]
		};
	}
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPng(buffer: Buffer): boolean {
	return buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

function extractPngTextChunks(buffer: Buffer): Record<string, string> {
	const text: Record<string, string> = {};
	let offset = PNG_SIGNATURE.length;

	while (offset + 12 <= buffer.length) {
		const length = buffer.readUInt32BE(offset);
		const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
		const dataStart = offset + 8;
		const dataEnd = dataStart + length;
		const nextOffset = dataEnd + 4;
		if (dataEnd > buffer.length || nextOffset > buffer.length) break;

		const data = buffer.subarray(dataStart, dataEnd);
		const entry = parseTextChunk(type, data);
		if (entry) text[entry.keyword] = entry.value;

		offset = nextOffset;
		if (type === 'IEND') break;
	}

	return text;
}

function parseTextChunk(type: string, data: Buffer): { keyword: string; value: string } | null {
	if (type === 'tEXt') {
		const separator = data.indexOf(0);
		if (separator <= 0) return null;
		return {
			keyword: data.subarray(0, separator).toString('latin1'),
			value: data.subarray(separator + 1).toString('latin1')
		};
	}

	if (type === 'zTXt') {
		const separator = data.indexOf(0);
		if (separator <= 0 || data[separator + 1] !== 0) return null;
		try {
			return {
				keyword: data.subarray(0, separator).toString('latin1'),
				value: inflateSync(data.subarray(separator + 2)).toString('latin1')
			};
		} catch {
			return null;
		}
	}

	if (type === 'iTXt') {
		return parseInternationalTextChunk(data);
	}

	return null;
}

function parseInternationalTextChunk(data: Buffer): { keyword: string; value: string } | null {
	const keywordEnd = data.indexOf(0);
	if (keywordEnd <= 0 || keywordEnd + 2 >= data.length) return null;

	const compressionFlag = data[keywordEnd + 1];
	const compressionMethod = data[keywordEnd + 2];
	let offset = keywordEnd + 3;

	const languageEnd = data.indexOf(0, offset);
	if (languageEnd < 0) return null;
	offset = languageEnd + 1;

	const translatedKeywordEnd = data.indexOf(0, offset);
	if (translatedKeywordEnd < 0) return null;
	offset = translatedKeywordEnd + 1;

	try {
		const encodedText = data.subarray(offset);
		const value =
			compressionFlag === 1 && compressionMethod === 0
				? inflateSync(encodedText).toString('utf8')
				: encodedText.toString('utf8');
		return {
			keyword: data.subarray(0, keywordEnd).toString('latin1'),
			value
		};
	} catch {
		return null;
	}
}
