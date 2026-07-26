import type { StorageMode } from '../shared/types';

export type StoragePolicy = {
	mode: StorageMode;
	reason: string;
};

const SOURCE_POLICY: Record<string, StoragePolicy> = {
	'instagram.com': { mode: 'download', reason: 'Original stored locally' },
	'cdninstagram.com': { mode: 'download', reason: 'Original stored locally' },
	'pbs.twimg.com': { mode: 'download', reason: 'Original stored locally' },
	'video.twimg.com': { mode: 'download', reason: 'Original stored locally' },
	'toyhou.se': { mode: 'download', reason: 'Original stored locally' },
	'tumblr.com': { mode: 'download', reason: 'Original stored locally' },
	'media.tumblr.com': { mode: 'download', reason: 'Original stored locally' },
	'cara.app': { mode: 'download', reason: 'Original stored locally' },
	'wikiart.org': { mode: 'download', reason: 'Original stored locally' }
};

export function policyForSource(url: string): StoragePolicy {
	const hostname = hostnameFor(url);
	for (const [suffix, policy] of Object.entries(SOURCE_POLICY)) {
		if (hostname === suffix || hostname.endsWith(`.${suffix}`)) return policy;
	}
	return { mode: 'download', reason: 'Original stored locally' };
}

export function resolveArtsyImage(url: string) {
	if (!url.includes('d32dm0rphc51dk.cloudfront.net')) return url;
	return url.replace(/\/(square|small|medium|large|normalized|tall)\.jpg$/, '/larger.jpg');
}

function hostnameFor(url: string) {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return '';
	}
}
