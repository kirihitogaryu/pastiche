import type { CapturedItemPayload } from '../shared/types';

export type CaptureBadgeState = 'pending' | 'confirmed' | 'error';

type SendMessage = (message: unknown) => Promise<unknown> | unknown;
type BadgeFn = (element: Element, state: CaptureBadgeState) => void;

type DeliveryResponse = { ok?: boolean; error?: string } | null | undefined;
type DeliveryResult = { ok: true } | { ok: false; error: string };

export type DeliverCapturedItemOptions = {
	element: Element;
	payload: CapturedItemPayload;
	selectedByUrl: Map<string, Element>;
	sendMessage: SendMessage;
	addBadge: BadgeFn;
	updateBadge: BadgeFn;
	removeBadge: (element: Element) => void;
};

export type DeliverCapturedItemsOptions = {
	type: 'PASTICHE_SWEEP_RESULTS' | 'PASTICHE_LASSO_RESULTS';
	items: Array<{ element: Element; payload: CapturedItemPayload }>;
	selectedByUrl: Map<string, Element>;
	sendMessage: SendMessage;
	addBadge: BadgeFn;
	updateBadge: BadgeFn;
	removeBadge: (element: Element) => void;
};

export async function deliverCapturedItem(
	options: DeliverCapturedItemOptions
): Promise<DeliveryResult> {
	const { element, payload, selectedByUrl, sendMessage, addBadge, updateBadge } = options;
	if (selectedByUrl.has(payload.url)) return { ok: true };

	selectedByUrl.set(payload.url, element);
	addBadge(element, 'pending');

	const result = await sendCaptureMessage(sendMessage, {
		type: 'PASTICHE_ITEM_CAPTURED',
		item: payload
	});
	if (result.ok) {
		updateBadge(element, 'confirmed');
		return { ok: true };
	}

	selectedByUrl.delete(payload.url);
	updateBadge(element, 'error');
	return result;
}

export async function deliverCapturedItems(
	options: DeliverCapturedItemsOptions
): Promise<DeliveryResult & { delivered?: number }> {
	const pending = options.items.filter((item) => !options.selectedByUrl.has(item.payload.url));
	if (pending.length === 0) return { ok: true, delivered: 0 };

	for (const item of pending) {
		options.selectedByUrl.set(item.payload.url, item.element);
		options.addBadge(item.element, 'pending');
	}

	const result = await sendCaptureMessage(options.sendMessage, {
		type: options.type,
		items: pending.map((item) => item.payload)
	});
	if (result.ok) {
		for (const item of pending) {
			options.updateBadge(item.element, 'confirmed');
		}
		return { ok: true, delivered: pending.length };
	}

	for (const item of pending) {
		options.selectedByUrl.delete(item.payload.url);
		options.updateBadge(item.element, 'error');
	}
	return result;
}

async function sendCaptureMessage(
	sendMessage: SendMessage,
	message: unknown
): Promise<DeliveryResult> {
	try {
		const response = (await sendMessage(message)) as DeliveryResponse;
		if (response?.ok === false) {
			return { ok: false, error: response.error ?? 'Capture failed' };
		}
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : 'Capture failed'
		};
	}
}
