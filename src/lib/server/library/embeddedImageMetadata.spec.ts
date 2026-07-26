import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { extractEmbeddedImageMetadataSync } from './embeddedImageMetadata';

describe('embedded PNG metadata limits', () => {
	it('reads ordinary compressed text chunks', () => {
		const result = extractEmbeddedImageMetadataSync(
			pngWithChunk('zTXt', Buffer.concat([Buffer.from('Comment\0\0'), deflateSync('small prompt')]))
		);
		expect(result.pngText).toEqual({ Comment: 'small prompt' });
	});

	it('drops compressed text whose expanded value exceeds the bounded output limit', () => {
		const compressedBomb = deflateSync(Buffer.alloc(9 * 1024 * 1024, 65));
		const result = extractEmbeddedImageMetadataSync(
			pngWithChunk('zTXt', Buffer.concat([Buffer.from('Comment\0\0'), compressedBomb]))
		);
		expect(result.kind).toBe('png');
		expect(result.pngText).toEqual({});
	});
});

function pngWithChunk(type: string, data: Buffer) {
	const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	return Buffer.concat([signature, pngChunk(type, data), pngChunk('IEND', Buffer.alloc(0))]);
}

function pngChunk(type: string, data: Buffer) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	return Buffer.concat([length, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
}
