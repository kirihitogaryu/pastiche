// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	candidatesForElement,
	extractCssUrls,
	extractSrcsetUrls,
	scanDocumentForCandidates
} from './candidate-scanner';

describe('candidate scanner', () => {
	beforeEach(() => {
		document.head.innerHTML = '';
		document.body.innerHTML = '';
	});

	it('collects the largest srcset candidate with dimensions from the width descriptor', () => {
		expect.assertions(2);
		document.body.innerHTML = `
			<img
				alt="Large horse reference"
				src="https://cdn.example.com/thumb/work-320.jpg"
				srcset="
					https://cdn.example.com/thumb/work-320.jpg 320w,
					https://cdn.example.com/full/work-2400.jpg 2400w
				"
			>
		`;

		const img = document.querySelector('img');
		if (!img) throw new Error('fixture image missing');
		const candidates = candidatesForElement(img, 'https://site.example/post/1');

		expect(candidates.map((candidate) => candidate.url)).toContain(
			'https://cdn.example.com/full/work-2400.jpg'
		);
		expect(candidates.find((candidate) => candidate.url.includes('2400'))?.width).toBe(2400);
	});

	it('collects CSS background and lazy data attribute candidates', () => {
		expect.assertions(2);
		document.body.innerHTML = `
			<div
				class="art"
				style="background-image: url('/images/background-full.webp')"
				data-full-src="https://cdn.example.com/original/work.png"
			></div>
		`;

		const element = document.querySelector('.art');
		if (!element) throw new Error('fixture element missing');
		const candidates = candidatesForElement(element, 'https://site.example/gallery');

		expect(candidates.map((candidate) => candidate.url)).toContain(
			'https://site.example/images/background-full.webp'
		);
		expect(candidates.map((candidate) => candidate.url)).toContain(
			'https://cdn.example.com/original/work.png'
		);
	});

	it('collects OpenGraph and JSON-LD metadata candidates from the document', () => {
		expect.assertions(1);
		document.head.innerHTML = `
			<meta property="og:image" content="/og/work.jpg">
			<script type="application/ld+json">
				{"image": {"url": "https://cdn.example.com/original/jsonld.png"}}
			</script>
		`;
		document.body.innerHTML = '<img src="/thumb/work-small.jpg" alt="Work">';

		const candidates = scanDocumentForCandidates({
			document,
			pageUrl: 'https://site.example/post/1'
		});

		expect(candidates.map((candidate) => candidate.url)).toEqual(
			expect.arrayContaining([
				'https://site.example/og/work.jpg',
				'https://cdn.example.com/original/jsonld.png'
			])
		);
	});

	it('parses multiple CSS url values and srcset descriptors', () => {
		expect.assertions(2);

		expect(extractCssUrls('image-set(url("/a-small.jpg") 1x, url("/a-large.jpg") 2x)')).toEqual([
			'/a-small.jpg',
			'/a-large.jpg'
		]);
		expect(extractSrcsetUrls('/small.jpg 320w, /large.jpg 1800w')).toEqual([
			{ url: '/small.jpg', width: 320, density: null },
			{ url: '/large.jpg', width: 1800, density: null }
		]);
	});
});
