let captureActive = false;

globalThis.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && captureActive) {
		captureActive = false;
		document.documentElement.style.cursor = '';
	}
});

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
	if (message.type !== 'PASTICHE_CAPTURE_ACTIVATE') return;
	captureActive = true;
	document.documentElement.style.cursor = 'crosshair';
});
