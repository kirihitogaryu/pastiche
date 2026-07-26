import type { ArtistCandidate, CandidateConfidence } from './candidates';

export type ArtistCandidateContext = {
	pageUrl: string;
	targetElement?: Element | null;
};

type RankedArtistCandidate = ArtistCandidate & {
	score: number;
};

const CREDIT_PATTERN =
	/\b(art(?:ist)?\s+by|author|byline|creator|credit(?:s|ed)?|drawn\s+by|illustrat(?:ed|ion|or))\b/i;
const PROFILE_CLASS_PATTERN = /\b(artist|author|byline|creator|credit|owner|profile|username)\b/i;
const RESERVED_PROFILE_SEGMENTS = new Set([
	'about',
	'accounts',
	'art',
	'collections',
	'explore',
	'gallery',
	'hashtag',
	'home',
	'i',
	'images',
	'follow',
	'login',
	'messages',
	'more',
	'notifications',
	'p',
	'post',
	'posts',
	'reel',
	'search',
	'settings',
	'share',
	'status',
	'tag',
	'tags',
	'tv'
]);

export function artistCandidatesForPage(
	document: Document,
	context: ArtistCandidateContext
): ArtistCandidate[] {
	const host = normalizedHost(context.pageUrl);
	const ranked = [
		...targetLocalCandidates(context.targetElement ?? null, host),
		...structuredCandidates(document),
		...siteCandidates(document, context, host)
	];
	return uniqueRankedCandidates(ranked)
		.filter((candidate) => candidate.score >= 55)
		.sort((left, right) => right.score - left.score)
		.slice(0, 5)
		.map(({ score, ...candidate }) => ({
			...candidate,
			confidence: confidenceForScore(score)
		}));
}

export function automaticallySelectedArtistCandidate(
	candidates: ArtistCandidate[]
): ArtistCandidate | null {
	const highConfidence = candidates.filter((candidate) => candidate.confidence === 'high');
	return highConfidence.length === 1 ? highConfidence[0] : null;
}

export function normalizeArtistCandidates(value: unknown): ArtistCandidate[] {
	if (!Array.isArray(value)) return [];
	const normalized: ArtistCandidate[] = [];
	for (const entry of value) {
		if (!entry || typeof entry !== 'object') continue;
		const candidate = entry as Partial<ArtistCandidate>;
		const label = cleanText(candidate.label);
		const reason = cleanText(candidate.reason);
		if (!label || !reason || !isCandidateConfidence(candidate.confidence)) continue;
		const profileUrl =
			typeof candidate.profileUrl === 'string'
				? safeAbsoluteUrl(candidate.profileUrl, candidate.profileUrl)
				: null;
		const username = cleanText(candidate.username)?.replace(/^@/, '') ?? null;
		normalized.push({
			label,
			username,
			profileUrl,
			confidence: candidate.confidence,
			reason
		});
	}
	return uniquePublicCandidates(normalized);
}

function targetLocalCandidates(target: Element | null, host: string): RankedArtistCandidate[] {
	if (!target) return [];
	const candidates: RankedArtistCandidate[] = [];
	for (const [depth, scope] of targetScopes(target).entries()) {
		for (const anchor of scope.querySelectorAll<HTMLAnchorElement>('a[href]')) {
			const profile = profileCandidateFromAnchor(anchor, host);
			if (!profile) continue;
			const contextText = nearbyIdentityText(anchor);
			const contextSignals = [
				anchor.getAttribute('rel'),
				anchor.getAttribute('itemprop'),
				anchor.getAttribute('data-testid'),
				anchor.className,
				anchor.id,
				anchor.parentElement?.className,
				anchor.parentElement?.id
			]
				.filter((value): value is string => typeof value === 'string')
				.join(' ');
			const creditMatch =
				CREDIT_PATTERN.test(contextText) || PROFILE_CLASS_PATTERN.test(contextSignals);
			const articleHeader = Boolean(anchor.closest('article header, [role="article"] header'));
			if (!creditMatch && !articleHeader) continue;
			candidates.push({
				...profile,
				score: Math.max(65, (creditMatch ? 124 : 105) - depth * 7),
				confidence: 'high',
				reason: creditReason(contextText, contextSignals, articleHeader)
			});
		}

		for (const label of scope.querySelectorAll<HTMLElement>(
			'h1, h2, h3, h4, dt, legend, strong, [class*="label"], [class*="heading"]'
		)) {
			const text = cleanText(label.textContent);
			if (!text || !CREDIT_PATTERN.test(text)) continue;
			for (const region of [label.parentElement, label.nextElementSibling]) {
				if (!region) continue;
				for (const anchor of region.querySelectorAll<HTMLAnchorElement>('a[href]')) {
					const profile = profileCandidateFromAnchor(anchor, host);
					if (!profile) continue;
					candidates.push({
						...profile,
						score: Math.max(80, 132 - depth * 7),
						confidence: 'high',
						reason: `${titleCase(text)} near image`
					});
				}
			}
		}
	}
	return candidates;
}

function targetScopes(target: Element): Element[] {
	const scopes: Element[] = [];
	let current: Element | null = target.parentElement;
	let depth = 0;
	while (current && current !== target.ownerDocument.body && depth < 8) {
		scopes.push(current);
		current = current.parentElement;
		depth += 1;
	}
	return scopes;
}

function structuredCandidates(document: Document): RankedArtistCandidate[] {
	const candidates: RankedArtistCandidate[] = [];
	for (const selector of [
		'[itemprop~="author"]',
		'[itemprop~="creator"]',
		'a[rel~="author"]',
		'[data-testid*="author"]'
	]) {
		for (const element of document.querySelectorAll<HTMLElement>(selector)) {
			const anchor =
				element instanceof HTMLAnchorElement
					? element
					: element.querySelector<HTMLAnchorElement>('a[href]');
			const label = cleanText(
				element.getAttribute('content') ?? element.textContent ?? anchor?.textContent
			);
			if (!label) continue;
			const profile = anchor ? safeAbsoluteUrl(anchor.href, document.baseURI) : null;
			candidates.push(
				rankedCandidate(
					label,
					profile,
					108,
					'Structured creator metadata',
					usernameFromProfile(profile)
				)
			);
		}
	}

	const authorMeta: Array<{ label: string | null; username: string | null }> = [
		{ label: metaContent(document, 'name', 'author'), username: null },
		{ label: metaContent(document, 'property', 'article:author'), username: null },
		{
			label: metaContent(document, 'name', 'twitter:creator'),
			username: metaContent(document, 'name', 'twitter:creator')?.replace(/^@/, '') ?? null
		}
	];
	for (const { label, username } of authorMeta) {
		if (!label) continue;
		candidates.push(
			rankedCandidate(label.replace(/^@/, ''), null, 96, 'Page creator metadata', username)
		);
	}

	for (const script of document.querySelectorAll<HTMLScriptElement>(
		'script[type="application/ld+json"]'
	)) {
		for (const identity of creatorValuesFromJson(script.textContent ?? '', document.baseURI)) {
			candidates.push(
				rankedCandidate(
					identity.label,
					identity.profileUrl,
					112,
					'Structured creator metadata',
					identity.username
				)
			);
		}
	}
	return candidates;
}

function siteCandidates(
	document: Document,
	context: ArtistCandidateContext,
	host: string
): RankedArtistCandidate[] {
	const candidates: RankedArtistCandidate[] = [];
	const pageUrl = context.pageUrl;
	if (host.endsWith('deviantart.com')) {
		const creator = metaContent(document, 'name', 'twitter:creator')?.replace(/^@/, '');
		if (creator) {
			candidates.push(
				rankedCandidate(
					creator,
					`https://www.deviantart.com/${creator}`,
					124,
					'DeviantArt creator',
					creator
				)
			);
		}
	}
	if (isXHost(host)) {
		const username = statusOwnerFromUrl(pageUrl);
		if (username) {
			candidates.push(
				rankedCandidate(username, `https://x.com/${username}`, 122, 'Post author', username)
			);
		}
	}
	if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
		const username = instagramUsernameFromMetadata(document);
		if (username) {
			candidates.push(
				rankedCandidate(
					username,
					`https://www.instagram.com/${username}`,
					114,
					'Instagram post owner',
					username
				)
			);
		}
	}
	if (host.endsWith('.tumblr.com')) {
		const username = host.slice(0, -'.tumblr.com'.length);
		if (username) {
			candidates.push(
				rankedCandidate(username, `https://${username}.tumblr.com`, 116, 'Tumblr blog', username)
			);
		}
	} else if (host === 'tumblr.com') {
		const username = tumblrPostOwnerFromUrl(pageUrl);
		if (username) {
			candidates.push(
				rankedCandidate(
					username,
					`https://www.tumblr.com/${username}`,
					118,
					'Tumblr post author',
					username
				)
			);
		}
	}
	if (host === 'pixiv.net' || host.endsWith('.pixiv.net')) {
		pushFirstProfileCandidate(
			candidates,
			document,
			'a[href*="/users/"]',
			126,
			'Pixiv artwork artist'
		);
	}
	if (host === 'furaffinity.net' || host.endsWith('.furaffinity.net')) {
		const mediaArtist = furAffinityArtistFromDocument(document, context.targetElement ?? null);
		if (mediaArtist) {
			candidates.push(
				rankedCandidate(
					mediaArtist,
					`https://www.furaffinity.net/user/${encodeURIComponent(mediaArtist)}/`,
					136,
					'Fur Affinity original media owner',
					mediaArtist
				)
			);
		} else {
			pushFirstProfileCandidate(
				candidates,
				document,
				[
					'.submission-id-sub-container a[href*="/user/"]',
					'.submission-id-container a[href*="/user/"]',
					'[class*="submission-id"] a[href*="/user/"]'
				].join(', '),
				128,
				'Fur Affinity submission artist'
			);
		}
	}
	if (host === 'toyhou.se' || host.endsWith('.toyhou.se')) {
		pushFirstProfileCandidate(
			candidates,
			document,
			'[class*="credit"] a[href], [data-tab*="credit"] a[href], .image-credits a[href]',
			124,
			'Toyhouse image credit'
		);
	}
	if (host.endsWith('.lofter.com') && host !== 'www.lofter.com') {
		const username = host.slice(0, -'.lofter.com'.length);
		if (username) {
			candidates.push(
				rankedCandidate(username, `https://${username}.lofter.com`, 116, 'Lofter blog', username)
			);
		}
	}
	if (host === 'weibo.com' || host.endsWith('.weibo.com')) {
		pushFirstProfileCandidate(
			candidates,
			document,
			'a[href*="/u/"], a[href*="/n/"]',
			106,
			'Weibo post author'
		);
	}
	if (host === 'vk.com' || host.endsWith('.vk.com')) {
		pushFirstProfileCandidate(
			candidates,
			document,
			'a.author, a[href*="/id"], a[href*="/club"], a[href*="/public"]',
			104,
			'VK post author'
		);
	}
	return candidates;
}

function furAffinityArtistFromDocument(
	document: Document,
	targetElement: Element | null
): string | null {
	const targetHref = targetElement
		?.closest<HTMLAnchorElement>('a[href*="d.furaffinity.net/art/"]')
		?.getAttribute('href');
	const submissionHref = document
		.querySelector<HTMLImageElement>('#submissionImg, img[data-fullview-src]')
		?.closest<HTMLAnchorElement>('a[href*="d.furaffinity.net/art/"]')
		?.getAttribute('href');
	const href =
		targetHref ??
		submissionHref ??
		document
			.querySelector<HTMLAnchorElement>('a[href*="d.furaffinity.net/art/"]')
			?.getAttribute('href');
	if (!href) return null;
	try {
		const url = new URL(href, document.baseURI);
		if (url.hostname !== 'd.furaffinity.net') return null;
		const match = url.pathname.match(/^\/art\/([^/]+)\//i);
		return match?.[1] ? decodeURIComponent(match[1]).trim().toLowerCase() : null;
	} catch {
		return null;
	}
}

function pushFirstProfileCandidate(
	candidates: RankedArtistCandidate[],
	document: Document,
	selector: string,
	score: number,
	reason: string
) {
	const anchor = document.querySelector<HTMLAnchorElement>(selector);
	if (!anchor) return;
	const label =
		cleanText(anchor.textContent) ??
		cleanText(anchor.getAttribute('aria-label')) ??
		cleanText(anchor.getAttribute('title'));
	const profileUrl = safeAbsoluteUrl(anchor.href, document.baseURI);
	if (!label || !profileUrl || looksLikeControlLabel(label)) return;
	candidates.push(
		rankedCandidate(label, profileUrl, score, reason, usernameFromProfile(profileUrl))
	);
}

function profileCandidateFromAnchor(
	anchor: HTMLAnchorElement,
	pageHost: string
): Omit<RankedArtistCandidate, 'score' | 'confidence' | 'reason'> | null {
	const profileUrl = safeAbsoluteUrl(anchor.href, anchor.ownerDocument.baseURI);
	if (!profileUrl || isNonProfileUrl(profileUrl, pageHost)) return null;
	const username = usernameFromProfile(profileUrl);
	const label =
		cleanText(anchor.textContent) ??
		cleanText(anchor.getAttribute('aria-label')) ??
		cleanText(anchor.getAttribute('title')) ??
		username;
	if (!label || looksLikeControlLabel(label)) return null;
	return { label: label.replace(/^@/, ''), username, profileUrl };
}

function rankedCandidate(
	labelInput: string,
	profileUrl: string | null,
	score: number,
	reason: string,
	username: string | null
): RankedArtistCandidate {
	const label = cleanText(labelInput)?.replace(/^@/, '') ?? username ?? 'Unknown artist';
	return {
		label,
		username: username?.replace(/^@/, '') || usernameFromProfile(profileUrl),
		profileUrl,
		score,
		confidence: confidenceForScore(score),
		reason
	};
}

function uniqueRankedCandidates(candidates: RankedArtistCandidate[]): RankedArtistCandidate[] {
	const byIdentity = new Map<string, RankedArtistCandidate>();
	for (const candidate of candidates) {
		const key = artistIdentityKey(candidate);
		if (!key) continue;
		const existing = byIdentity.get(key);
		if (!existing || candidate.score > existing.score) {
			byIdentity.set(key, {
				...candidate,
				profileUrl: candidate.profileUrl ?? existing?.profileUrl ?? null,
				username: candidate.username ?? existing?.username ?? null
			});
		}
	}
	return [...byIdentity.values()];
}

function uniquePublicCandidates(candidates: ArtistCandidate[]): ArtistCandidate[] {
	const seen = new Set<string>();
	return candidates.filter((candidate) => {
		const key = artistIdentityKey(candidate);
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function artistIdentityKey(candidate: ArtistCandidate): string {
	if (candidate.username) return candidate.username.replace(/^@/, '').toLowerCase();
	const profileUsername = usernameFromProfile(candidate.profileUrl);
	if (profileUsername) return profileUsername.toLowerCase();
	if (candidate.profileUrl) return normalizeProfileUrl(candidate.profileUrl);
	return candidate.label.trim().toLowerCase();
}

function creatorValuesFromJson(
	value: string,
	baseUrl: string
): Array<{
	label: string;
	profileUrl: string | null;
	username: string | null;
}> {
	try {
		const parsed = JSON.parse(value) as unknown;
		const values: Array<{ label: string; profileUrl: string | null; username: string | null }> = [];
		walkJson(parsed, (entry) => {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
			const record = entry as Record<string, unknown>;
			for (const key of ['author', 'creator']) {
				for (const creator of asArray(record[key])) {
					if (typeof creator === 'string') {
						const label = cleanText(creator);
						if (label) values.push({ label, profileUrl: null, username: null });
						continue;
					}
					if (!creator || typeof creator !== 'object' || Array.isArray(creator)) continue;
					const identity = creator as Record<string, unknown>;
					const label = cleanText(
						typeof identity.name === 'string'
							? identity.name
							: typeof identity.alternateName === 'string'
								? identity.alternateName
								: null
					);
					if (!label) continue;
					const profileUrl =
						typeof identity.url === 'string' ? safeAbsoluteUrl(identity.url, baseUrl) : null;
					values.push({ label, profileUrl, username: usernameFromProfile(profileUrl) });
				}
			}
		});
		return values;
	} catch {
		return [];
	}
}

function walkJson(value: unknown, visit: (entry: unknown) => void) {
	visit(value);
	if (Array.isArray(value)) {
		value.forEach((entry) => walkJson(entry, visit));
		return;
	}
	if (!value || typeof value !== 'object') return;
	Object.values(value as Record<string, unknown>).forEach((entry) => walkJson(entry, visit));
}

function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

function nearbyIdentityText(anchor: HTMLAnchorElement): string {
	const immediate = cleanText(anchor.parentElement?.textContent) ?? '';
	const region = anchor.closest(
		'[class*="credit"], [class*="artist"], [class*="author"], [class*="byline"], [itemprop="author"], [itemprop="creator"]'
	);
	return `${immediate} ${cleanText(region?.textContent) ?? ''}`.slice(0, 500);
}

function creditReason(contextText: string, contextSignals: string, articleHeader: boolean): string {
	if (/\bcredit/i.test(`${contextText} ${contextSignals}`)) return 'Credits near image';
	if (/\bartist|art\s+by|drawn\s+by|illustrat/i.test(`${contextText} ${contextSignals}`)) {
		return 'Artist near image';
	}
	if (articleHeader) return 'Post author near image';
	return 'Creator near image';
}

function usernameFromProfile(value: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		const host = normalizedHost(value);
		if (host.endsWith('.tumblr.com')) return host.slice(0, -'.tumblr.com'.length);
		const segments = url.pathname
			.split('/')
			.map((segment) =>
				decodeURIComponent(segment)
					.replace(/^[@~]+/, '')
					.trim()
			)
			.filter(Boolean);
		const first = segments[0];
		if (!first || RESERVED_PROFILE_SEGMENTS.has(first.toLowerCase())) return null;
		return first;
	} catch {
		return null;
	}
}

function isNonProfileUrl(value: string, pageHost: string): boolean {
	try {
		const url = new URL(value);
		const host = normalizedHost(value);
		const path = url.pathname.toLowerCase();
		if (/javascript:|mailto:/.test(url.protocol)) return true;
		if (/\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/.test(path)) return true;
		if (/\/(?:art|image|images|post|posts|status|tag|tags)\//.test(path)) return true;
		if (host === pageHost && !usernameFromProfile(value)) return true;
		return false;
	} catch {
		return true;
	}
}

function looksLikeControlLabel(value: string): boolean {
	return /^(back|close|comments?|download|favorite|follow|gallery|home|image|link|menu|more|next|options|previous|profile|report|save|share|source|subscribe)$/i.test(
		value.trim()
	);
}

function metaContent(
	document: Document,
	attribute: 'name' | 'property',
	key: string
): string | null {
	const value = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)?.content;
	return value?.trim() || null;
}

function instagramUsernameFromMetadata(document: Document): string | null {
	const values = [
		metaContent(document, 'name', 'twitter:title'),
		metaContent(document, 'property', 'og:title'),
		metaContent(document, 'property', 'og:description'),
		metaContent(document, 'name', 'description')
	].filter((value): value is string => Boolean(value));
	for (const value of values) {
		const mention = value.match(/@([a-z0-9._]+)/i)?.[1];
		if (mention) return mention;
		const owner = value.match(/[-–]\s*([a-z0-9._]+)\s+on\s+(?:Instagram|[A-Z][a-z]{2}\s+\d)/i)?.[1];
		if (owner) return owner;
	}
	return null;
}

function statusOwnerFromUrl(value: string): string | null {
	try {
		const parts = new URL(value).pathname.split('/').filter(Boolean);
		return parts[1] === 'status' && parts[0] ? parts[0].replace(/^@/, '') : null;
	} catch {
		return null;
	}
}

function tumblrPostOwnerFromUrl(value: string): string | null {
	try {
		const parts = new URL(value).pathname.split('/').filter(Boolean);
		const username = parts[0]?.replace(/^@/, '');
		return username && !RESERVED_PROFILE_SEGMENTS.has(username.toLowerCase()) ? username : null;
	} catch {
		return null;
	}
}

function safeAbsoluteUrl(value: string, baseUrl: string): string | null {
	try {
		const url = new URL(value, baseUrl);
		return /^https?:$/.test(url.protocol) ? url.toString() : null;
	} catch {
		return null;
	}
}

function normalizeProfileUrl(value: string): string {
	try {
		const url = new URL(value);
		url.hash = '';
		url.search = '';
		url.pathname = url.pathname.replace(/\/+$/, '');
		return url.toString().toLowerCase();
	} catch {
		return value.trim().toLowerCase();
	}
}

function normalizedHost(value: string): string {
	try {
		return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
	} catch {
		return '';
	}
}

function cleanText(value: string | null | undefined): string | null {
	const clean = value?.replace(/\s+/g, ' ').trim();
	return clean || null;
}

function titleCase(value: string): string {
	return value
		.toLowerCase()
		.replace(/\b\w/g, (character) => character.toUpperCase())
		.trim();
}

function confidenceForScore(score: number): CandidateConfidence {
	if (score >= 95) return 'high';
	if (score >= 70) return 'medium';
	return 'low';
}

function isCandidateConfidence(value: unknown): value is CandidateConfidence {
	return value === 'high' || value === 'medium' || value === 'low';
}

function isXHost(host: string): boolean {
	return host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com';
}
