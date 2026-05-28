import type { StorageMode } from '../../src/lib/library/types';

export type StoragePolicy = {
	mode: StorageMode;
	reason: string;
};

const SOURCE_POLICY: Record<string, StoragePolicy> = {
	'metmuseum.org': { mode: 'url_reference', reason: 'Met permanent URL' },
	'artic.edu': { mode: 'url_reference', reason: 'ARTIC IIIF permanent' },
	'rijksmuseum.nl': { mode: 'url_reference', reason: 'Rijksmuseum permanent' },
	'clevelandart.org': { mode: 'url_reference', reason: 'CMA permanent URL' },
	'commons.wikimedia.org': { mode: 'url_reference', reason: 'Wikimedia permanent' },
	'upload.wikimedia.org': { mode: 'url_reference', reason: 'Wikimedia permanent' },
	'cloudfront.net': { mode: 'url_reference', reason: 'Stable CDN' },
	'instagram.com': { mode: 'download', reason: 'Token-authenticated' },
	'cdninstagram.com': { mode: 'download', reason: 'Token-authenticated' },
	'pbs.twimg.com': { mode: 'download', reason: 'Ephemeral' },
	'video.twimg.com': { mode: 'download', reason: 'Ephemeral' },
	'toyhou.se': { mode: 'download', reason: 'May be taken down' },
	'tumblr.com': { mode: 'download', reason: 'May be taken down' },
	'media.tumblr.com': { mode: 'download', reason: 'May be taken down' },
	'cara.app': { mode: 'download', reason: 'May be taken down' },
	'wikiart.org': { mode: 'download', reason: 'Unstable CDN URLs' }
};

export function policyForSource(url: string): StoragePolicy {
	const hostname = hostnameFor(url);
	for (const [suffix, policy] of Object.entries(SOURCE_POLICY)) {
		if (hostname === suffix || hostname.endsWith(`.${suffix}`)) return policy;
	}
	return { mode: 'lazy_download', reason: 'Reference + background copy' };
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
