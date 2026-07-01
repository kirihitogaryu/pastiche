import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import { extractEmbeddedImageMetadata } from './embeddedImageMetadata';

describe('embedded image metadata', () => {
	it('extracts PNG text chunks from image buffers', async () => {
		const png = await pngWithTextChunks({
			Software: 'NovelAI',
			Description: '1girl, dragon',
			Comment: JSON.stringify({ seed: 1234 })
		});

		const metadata = await extractEmbeddedImageMetadata(png);

		expect(metadata.kind).toBe('png');
		expect(metadata.pngText.Software).toBe('NovelAI');
		expect(metadata.pngText.Description).toBe('1girl, dragon');
		expect(metadata.pngText.Comment).toBe(JSON.stringify({ seed: 1234 }));
		expect(metadata.warnings).toEqual([]);
	});

	it('returns unknown metadata for invalid image buffers without throwing', async () => {
		const metadata = await extractEmbeddedImageMetadata(Buffer.from('not an image'));

		expect(metadata.kind).toBe('unknown');
		expect(metadata.pngText).toEqual({});
		expect(metadata.warnings.length).toBeGreaterThan(0);
	});
});

async function pngWithTextChunks(text: Record<string, string>) {
	const base = await sharp({
		create: {
			width: 1,
			height: 1,
			channels: 4,
			background: { r: 255, g: 255, b: 255, alpha: 1 }
		}
	})
		.png()
		.toBuffer();

	const endIndex = base.length - 12;
	const chunks = Object.entries(text).map(([keyword, value]) =>
		pngChunk('tEXt', Buffer.from(`${keyword}\0${value}`, 'latin1'))
	);
	return Buffer.concat([base.subarray(0, endIndex), ...chunks, base.subarray(endIndex)]);
}

function pngChunk(type: string, data: Buffer) {
	const typeBuffer = Buffer.from(type, 'ascii');
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
	return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer: Buffer) {
	let crc = 0xffffffff;
	for (const byte of buffer) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}
