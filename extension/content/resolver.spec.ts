// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { resolveElement } from './resolver';

describe('image resolver compatibility wrapper', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('selects the strongest srcset candidate for an image element and preserves alternates', () => {
		expect.assertions(5);
		document.body.innerHTML = `
			<img
				alt="Large creature reference"
				src="https://cdn.example.com/thumb/work-320.jpg"
				srcset="
					https://cdn.example.com/thumb/work-320.jpg 320w,
					https://cdn.example.com/original/work-2400.jpg 2400w
				"
			>
		`;
		const img = document.querySelector('img');
		if (!img) throw new Error('fixture image missing');

		const resolved = resolveElement(img);

		expect(resolved?.url).toBe('https://cdn.example.com/original/work-2400.jpg');
		expect(resolved?.naturalWidth).toBe(2400);
		expect(resolved?.selectedCandidateId).toBeTruthy();
		expect(resolved?.candidates.map((candidate) => candidate.url)).toContain(
			'https://cdn.example.com/thumb/work-320.jpg'
		);
		expect(resolved?.metadata.title).toBe('Large creature reference');
	});
});
