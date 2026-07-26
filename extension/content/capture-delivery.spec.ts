// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapturedItemPayload } from '../shared/types';
import { deliverCapturedItem, deliverCapturedItems } from './capture-delivery';

function payload(url: string): CapturedItemPayload {
	return {
		url,
		detailUrl: null,
		naturalWidth: 800,
		naturalHeight: 600,
		mimeType: 'image/jpeg',
		inlineData: null,
		altText: null,
		sourceUrl: 'https://example.com/post/1',
		pageTitle: 'Example',
		capturedAt: '2026-06-30T12:00:00.000Z'
	};
}

describe('content capture delivery', () => {
	beforeEach(() => {
		document.body.innerHTML = '<img id="target" src="https://cdn.example.com/work.jpg">';
	});

	it('marks a single clicked image pending, then confirms it after the worker accepts it', async () => {
		expect.assertions(5);
		const element = document.querySelector('#target');
		if (!element) throw new Error('target fixture missing');
		const selectedByUrl = new Map<string, Element>();
		const addBadge = vi.fn();
		const updateBadge = vi.fn();
		const removeBadge = vi.fn();
		const sendMessage = vi.fn(async () => ({ ok: true }));

		const result = await deliverCapturedItem({
			element,
			payload: payload('https://cdn.example.com/work.jpg'),
			selectedByUrl,
			sendMessage,
			addBadge,
			updateBadge,
			removeBadge
		});

		expect(result).toEqual({ ok: true });
		expect(addBadge).toHaveBeenCalledWith(element, 'pending');
		expect(sendMessage).toHaveBeenCalledWith({
			type: 'PASTICHE_ITEM_CAPTURED',
			item: payload('https://cdn.example.com/work.jpg')
		});
		expect(updateBadge).toHaveBeenCalledWith(element, 'confirmed');
		expect(selectedByUrl.get('https://cdn.example.com/work.jpg')).toBe(element);
	});

	it('marks a failed capture without leaving the URL selected', async () => {
		expect.assertions(5);
		const element = document.querySelector('#target');
		if (!element) throw new Error('target fixture missing');
		const selectedByUrl = new Map<string, Element>();
		const addBadge = vi.fn();
		const updateBadge = vi.fn();
		const removeBadge = vi.fn();

		const result = await deliverCapturedItem({
			element,
			payload: payload('https://cdn.example.com/work.jpg'),
			selectedByUrl,
			sendMessage: async () => ({ ok: false, error: 'Could not enrich capture' }),
			addBadge,
			updateBadge,
			removeBadge
		});

		expect(result).toEqual({ ok: false, error: 'Could not enrich capture' });
		expect(addBadge).toHaveBeenCalledWith(element, 'pending');
		expect(updateBadge).toHaveBeenCalledWith(element, 'error');
		expect(removeBadge).not.toHaveBeenCalled();
		expect(selectedByUrl.has('https://cdn.example.com/work.jpg')).toBe(false);
	});

	it('confirms batch badges only after the sweep message is accepted', async () => {
		expect.assertions(4);
		document.body.innerHTML = `
			<img id="one" src="https://cdn.example.com/one.jpg">
			<img id="two" src="https://cdn.example.com/two.jpg">
		`;
		const one = document.querySelector('#one');
		const two = document.querySelector('#two');
		if (!one || !two) throw new Error('batch fixtures missing');
		const selectedByUrl = new Map<string, Element>();
		const updateBadge = vi.fn();

		const result = await deliverCapturedItems({
			type: 'PASTICHE_SWEEP_RESULTS',
			items: [
				{ element: one, payload: payload('https://cdn.example.com/one.jpg') },
				{ element: two, payload: payload('https://cdn.example.com/two.jpg') }
			],
			selectedByUrl,
			sendMessage: async () => ({ ok: true }),
			addBadge: vi.fn(),
			updateBadge,
			removeBadge: vi.fn()
		});

		expect(result).toEqual({ ok: true, delivered: 2 });
		expect(updateBadge).toHaveBeenCalledWith(one, 'confirmed');
		expect(updateBadge).toHaveBeenCalledWith(two, 'confirmed');
		expect([...selectedByUrl.keys()]).toEqual([
			'https://cdn.example.com/one.jpg',
			'https://cdn.example.com/two.jpg'
		]);
	});
});
