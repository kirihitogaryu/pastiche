import type {
	CandidateConfidence,
	MetadataProvenance,
	ProvenancedValue,
	SourceCaptureRecord,
	SourceCreator,
	SourceCreatorRole,
	SourceMedia,
	SourceSensitivity,
	SourceTag
} from '../shared/candidates';

export type LiveMetadataContext = {
	pageUrl: string;
	imageUrl: string;
	targetElement: Element | null;
};

type Adapter = {
	id: string;
	matches(host: string): boolean;
	extract(document: Document, context: LiveMetadataContext): SourceCaptureRecord;
};

const ADAPTERS: Adapter[] = [
	{ id: 'pixiv', matches: hostMatches('pixiv.net'), extract: extractPixiv },
	{ id: 'toyhouse', matches: hostMatches('toyhou.se'), extract: extractToyhouse },
	{ id: 'furaffinity', matches: hostMatches('furaffinity.net'), extract: extractFurAffinity },
	{ id: 'instagram', matches: hostMatches('instagram.com'), extract: extractInstagram },
	{ id: 'tumblr', matches: hostMatches('tumblr.com'), extract: extractTumblr },
	{
		id: 'x',
		matches: (host) => hostMatches('x.com')(host) || hostMatches('twitter.com')(host),
		extract: extractX
	},
	{ id: 'lofter', matches: hostMatches('lofter.com'), extract: extractLofter },
	{ id: 'vk', matches: hostMatches('vk.com'), extract: extractVk },
	{ id: 'weibo', matches: hostMatches('weibo.com'), extract: extractWeibo }
];

export function extractLiveMetadata(
	document: Document,
	context: LiveMetadataContext
): SourceCaptureRecord {
	const host = hostname(context.pageUrl);
	const adapter = ADAPTERS.find((entry) => entry.matches(host));
	return (adapter ?? { id: 'generic', extract: extractGeneric }).extract(document, context);
}

export function selectorForElement(element: Element | null): string | null {
	if (!element) return null;
	if (element.id && isUniqueSelector(`#${cssEscape(element.id)}`, element.ownerDocument)) {
		return `#${cssEscape(element.id)}`;
	}
	for (const attribute of ['data-testid', 'data-id', 'data-image-id', 'data-post-id']) {
		const value = element.getAttribute(attribute);
		if (!value) continue;
		const selector = `[${attribute}="${cssEscape(value)}"]`;
		if (isUniqueSelector(selector, element.ownerDocument)) return selector;
	}

	const path: string[] = [];
	let current: Element | null = element;
	for (let depth = 0; current && depth < 7; depth += 1) {
		const parent: Element | null = current.parentElement;
		const tag = current.tagName.toLowerCase();
		if (!parent) {
			path.unshift(tag);
			break;
		}
		const siblings = [...parent.children].filter((entry) => entry.tagName === current?.tagName);
		const suffix = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : '';
		path.unshift(`${tag}${suffix}`);
		const selector = path.join(' > ');
		if (isUniqueSelector(selector, element.ownerDocument)) return selector;
		current = parent;
	}
	return path.join(' > ') || null;
}

function extractGeneric(document: Document, context: LiveMetadataContext): SourceCaptureRecord {
	const container = closestPostContainer(context.targetElement) ?? document.body;
	const canonicalPostUrl =
		closestCanonicalLink(context.targetElement, context.pageUrl) ??
		metaContent(document, 'property', 'og:url') ??
		context.pageUrl;
	const title =
		textFrom(container, ['h1', 'h2', '[itemprop="name"]', 'figcaption']) ??
		metaContent(document, 'property', 'og:title') ??
		document.title ??
		null;
	const description =
		textFrom(container, ['[itemprop="description"]', '.description', '.caption']) ??
		metaContent(document, 'property', 'og:description') ??
		metaContent(document, 'name', 'description');
	const date =
		attributeFrom(container, ['time[datetime]'], 'datetime') ??
		textFrom(container, ['time', '[itemprop="datePublished"]']);
	const creators = genericCreators(container, context.pageUrl);
	const sourceTags = genericTags(container, 'generic');
	const media = mediaFromContainer(container, context, 'dom');
	const jsonLd = structuredObjects(document);
	const jsonLdRecord = recordFromStructuredData(jsonLd, context);

	return finalizeRecord({
		adapterId: 'generic',
		canonicalPostUrl: jsonLdRecord.canonicalPostUrl || canonicalPostUrl,
		sourcePostId: null,
		title: provenanced(
			title ?? jsonLdRecord.title?.value ?? null,
			title ? 'dom' : 'json_ld',
			'page title'
		),
		description: provenanced(
			description ?? jsonLdRecord.description?.value ?? null,
			description ? 'dom' : 'json_ld',
			'description'
		),
		publishedAt: provenanced(
			date ?? jsonLdRecord.publishedAt?.value ?? null,
			date ? 'dom' : 'json_ld',
			'publication date'
		),
		creators: mergeCreators(creators, jsonLdRecord.creators),
		media: mergeMedia(media, jsonLdRecord.media),
		sourceTags,
		sensitivity: sensitivityFromDocument(document),
		rights: rightsFromDocument(document),
		extractedAt: new Date().toISOString()
	});
}

function extractPixiv(document: Document, context: LiveMetadataContext): SourceCaptureRecord {
	const workId = context.pageUrl.match(/\/artworks\/(\d+)/)?.[1] ?? null;
	const embedded = embeddedObjects(document);
	const illust =
		findObject(embedded, (entry) => {
			const id = stringValue(entry.illustId) ?? stringValue(entry.id);
			return Boolean(
				id &&
				(!workId || id === workId) &&
				(entry.illustTitle || entry.title) &&
				(entry.userName || entry.userId || entry.urls)
			);
		}) ?? null;
	const container = closestPostContainer(context.targetElement) ?? document.body;
	const title =
		stringValue(illust?.illustTitle) ??
		stringValue(illust?.title) ??
		textFrom(container, ['h1', '[role="heading"]']);
	const description =
		cleanHtml(stringValue(illust?.illustComment) ?? stringValue(illust?.description)) ??
		textFrom(container, ['figcaption', '[class*="caption"]']);
	const userId = stringValue(illust?.userId);
	const username = stringValue(illust?.userAccount);
	const artistName =
		stringValue(illust?.userName) ??
		textFrom(container, ['a[href*="/users/"] span', 'a[href*="/users/"]']);
	const artistLink =
		(userId ? `https://www.pixiv.net/users/${userId}` : null) ??
		hrefFrom(container, ['a[href*="/users/"]']);
	const creators = artistName
		? [
				creator({
					role: 'artist',
					displayName: artistName,
					username,
					profileUrl: artistLink,
					sourceId: userId,
					confidence: 'high',
					provenance: illust ? 'embedded_json' : 'dom',
					evidence: illust ? 'Pixiv artwork data' : 'artwork artist link'
				})
			]
		: genericCreators(container, context.pageUrl);
	const tags = pixivTags(illust, container);
	const pageCount = numberValue(illust?.pageCount) ?? 1;
	const originalUrl = nestedString(illust, ['urls', 'original']);
	const media = originalUrl
		? Array.from({ length: Math.max(1, Math.min(pageCount, 100)) }, (_, index) =>
				mediaItem({
					sourceMediaId: workId ? `${workId}_p${index}` : null,
					ordinal: index,
					originalUrl: pixivPageUrl(originalUrl, index),
					previewUrl: index === 0 ? context.imageUrl : null,
					width: numberValue(illust?.width),
					height: numberValue(illust?.height),
					mimeType: mimeFromUrl(originalUrl),
					altText: title,
					kind: 'image',
					referrer: context.pageUrl,
					provenance: 'embedded_json'
				})
			)
		: mediaFromContainer(container, context, 'dom').map((entry) => ({
				...entry,
				referrer: context.pageUrl
			}));
	const restriction = numberValue(illust?.xRestrict);
	const sensitivity: SourceSensitivity | null =
		restriction === 1
			? { level: 'mature', label: 'R-18', provenance: 'embedded_json' }
			: restriction === 2
				? { level: 'explicit', label: 'R-18G', provenance: 'embedded_json' }
				: restriction === 0
					? { level: 'general', label: 'General', provenance: 'embedded_json' }
					: sensitivityFromDocument(document);

	return finalizeRecord({
		adapterId: 'pixiv',
		canonicalPostUrl: workId ? `https://www.pixiv.net/artworks/${workId}` : context.pageUrl,
		sourcePostId: workId,
		title: provenanced(title, illust ? 'embedded_json' : 'dom', 'Pixiv artwork title'),
		description: provenanced(
			description,
			illust ? 'embedded_json' : 'dom',
			'Pixiv artwork caption'
		),
		publishedAt: provenanced(
			stringValue(illust?.createDate) ?? attributeFrom(container, ['time[datetime]'], 'datetime'),
			illust ? 'embedded_json' : 'dom',
			'Pixiv publication date'
		),
		creators,
		media,
		sourceTags: tags,
		sensitivity,
		rights: rightsFromDocument(document),
		extractedAt: new Date().toISOString()
	});
}

function extractToyhouse(document: Document, context: LiveMetadataContext): SourceCaptureRecord {
	const imageId =
		context.pageUrl.match(/(?:~images\/|#)(\d+)/)?.[1] ??
		context.imageUrl.match(/\/(\d+)[^/]*\.(?:png|jpe?g|gif|webp)/i)?.[1] ??
		null;
	const container =
		context.targetElement?.closest(
			'.modal-content, [role="dialog"], .image-viewer, .gallery-view, .image-details'
		) ??
		closestPostContainer(context.targetElement) ??
		document.body;
	const creditScopes = [
		...container.querySelectorAll<HTMLElement>(
			'[class*="credit"], [data-tab*="credit"], [id*="credit"], .image-credits'
		)
	];
	const creatorScope = creditScopes[0] ?? container;
	const creators = linksAsCreators(creatorScope, 'a[href^="/"], a[href*="toyhou.se/"]', {
		role: 'artist',
		pageUrl: context.pageUrl,
		allow: (url) =>
			!/[~#?]/.test(new URL(url).pathname) &&
			!/(character|world|gallery|library|settings|comments|favorites)/i.test(url)
	});
	const title =
		textFrom(container, ['h1', 'h2', '.image-title', '[class*="title"]']) ??
		metaContent(document, 'property', 'og:title');
	const date =
		attributeFrom(container, ['time[datetime]'], 'datetime') ??
		textFrom(container, ['time', '[class*="date"]']);
	const characters = [...container.querySelectorAll<HTMLAnchorElement>('a[href*="/character/"]')]
		.map((anchor) => cleanText(anchor.textContent))
		.filter((value): value is string => Boolean(value));
	const sourceTags = uniqueTags(
		characters.map((label) =>
			sourceTag('toyhouse', 'character', label, null, 'a[href*="/character/"]', 'high')
		)
	);

	return finalizeRecord({
		adapterId: 'toyhouse',
		canonicalPostUrl: imageId ? `https://toyhou.se/~images/${imageId}` : context.pageUrl,
		sourcePostId: imageId,
		title: provenanced(title, 'dom', 'Toyhouse image title'),
		description: provenanced(
			textFrom(container, ['.image-description', '[class*="description"]', 'figcaption']),
			'dom',
			'Toyhouse image description'
		),
		publishedAt: provenanced(date, 'dom', 'Toyhouse image date'),
		creators: creators.length ? creators : genericCreators(container, context.pageUrl),
		media: mediaFromContainer(container, context, 'dom'),
		sourceTags,
		sensitivity: sensitivityFromDocument(document),
		rights: rightsFromDocument(document),
		extractedAt: new Date().toISOString()
	});
}

function extractFurAffinity(document: Document, context: LiveMetadataContext): SourceCaptureRecord {
	const submissionId = context.pageUrl.match(/\/view\/(\d+)/)?.[1] ?? null;
	const container =
		context.targetElement?.closest('#page-submission, .submission-content, main') ??
		document.querySelector('#page-submission, .submission-content, main') ??
		document.body;
	const artistAnchor =
		container.querySelector<HTMLAnchorElement>(
			[
				'.submission-id-sub-container a[href*="/user/"]',
				'.submission-id-container a[href*="/user/"]',
				'[class*="submission-id"] a[href*="/user/"]'
			].join(', ')
		) ?? null;
	const media = mediaFromContainer(container, context, 'dom');
	const submissionImage = document.querySelector<HTMLImageElement>(
		'#submissionImg, img[data-fullview-src]'
	);
	let originalMediaUrl: string | null = null;
	if (submissionImage) {
		const original =
			submissionImage.dataset.fullviewSrc ??
			submissionImage.closest<HTMLAnchorElement>('a[href]')?.getAttribute('href') ??
			submissionImage.currentSrc ??
			submissionImage.src;
		if (original) {
			originalMediaUrl = absoluteUrl(original, context.pageUrl);
			media.unshift(
				mediaItem({
					sourceMediaId: submissionId,
					ordinal: 0,
					originalUrl: originalMediaUrl,
					previewUrl: submissionImage.currentSrc || submissionImage.src || context.imageUrl,
					width: submissionImage.naturalWidth || null,
					height: submissionImage.naturalHeight || null,
					mimeType: mimeFromUrl(original),
					altText: submissionImage.alt || null,
					kind: 'image',
					referrer: context.pageUrl,
					provenance: 'dom'
				})
			);
		}
	}
	const mediaArtistUsername = furAffinityArtistFromMediaUrl(originalMediaUrl);
	const anchorProfileUrl = absoluteUrl(
		artistAnchor?.getAttribute('href') ?? artistAnchor?.href,
		context.pageUrl
	);
	const anchorUsername = furAffinityUsernameFromProfileUrl(anchorProfileUrl);
	const artistUsername = mediaArtistUsername ?? anchorUsername;
	const artistName =
		mediaArtistUsername && anchorUsername !== mediaArtistUsername
			? mediaArtistUsername
			: (cleanText(artistAnchor?.textContent) ?? artistUsername);
	const artistProfileUrl = artistUsername
		? `https://www.furaffinity.net/user/${encodeURIComponent(artistUsername)}/`
		: anchorProfileUrl;
	const tagAnchors = [
		...container.querySelectorAll<HTMLAnchorElement>(
			'a[href*="/search/"], a[href*="/browse/"][href*="tag"], .tags a'
		)
	];
	const sourceTags = uniqueTags(
		tagAnchors.flatMap((anchor) => {
			const label = cleanText(anchor.textContent);
			return label
				? [
						sourceTag(
							'furaffinity',
							'tag',
							label,
							absoluteUrl(anchor.getAttribute('href') ?? anchor.href, context.pageUrl),
							'submission tags',
							'high'
						)
					]
				: [];
		})
	);
	const ratingText = textFrom(container, ['[class*="rating"]', '.rating']);

	return finalizeRecord({
		adapterId: 'furaffinity',
		canonicalPostUrl: submissionId
			? `https://www.furaffinity.net/view/${submissionId}/`
			: context.pageUrl,
		sourcePostId: submissionId,
		title: provenanced(
			textFrom(container, ['.submission-title', 'h1', 'h2']) ??
				metaContent(document, 'property', 'og:title'),
			'dom',
			'Fur Affinity submission title'
		),
		description: provenanced(
			textFrom(container, ['.submission-description', '.user-submitted-links + div']),
			'dom',
			'Fur Affinity submission description'
		),
		publishedAt: provenanced(
			attributeFrom(container, ['time[datetime]'], 'datetime') ??
				attributeFrom(container, ['[data-timestamp]'], 'data-timestamp'),
			'dom',
			'Fur Affinity publication date'
		),
		creators:
			artistName && artistProfileUrl
				? [
						creator({
							role: 'artist',
							displayName: artistName,
							username: artistUsername,
							profileUrl: artistProfileUrl,
							sourceId: null,
							confidence: 'high',
							provenance: 'dom',
							evidence: 'submission artist link'
						})
					]
				: [],
		media: uniqueMedia(media),
		sourceTags,
		sensitivity: ratingText
			? {
					level: /adult|explicit/i.test(ratingText)
						? 'explicit'
						: /mature/i.test(ratingText)
							? 'mature'
							: 'general',
					label: ratingText,
					provenance: 'dom'
				}
			: sensitivityFromDocument(document),
		rights: rightsFromDocument(document),
		extractedAt: new Date().toISOString()
	});
}

function furAffinityArtistFromMediaUrl(value: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		if (url.hostname !== 'd.furaffinity.net') return null;
		const match = url.pathname.match(/^\/art\/([^/]+)\//i);
		return match?.[1] ? decodeURIComponent(match[1]).trim().toLowerCase() : null;
	} catch {
		return null;
	}
}

function furAffinityUsernameFromProfileUrl(value: string | null): string | null {
	if (!value) return null;
	try {
		const match = new URL(value).pathname.match(/^\/user\/([^/]+)/i);
		return match?.[1] ? decodeURIComponent(match[1]).trim().toLowerCase() : null;
	} catch {
		return null;
	}
}

function extractInstagram(document: Document, context: LiveMetadataContext): SourceCaptureRecord {
	return enhanceGeneric(extractGeneric(document, context), 'instagram', context, {
		postId: context.pageUrl.match(/\/(?:p|reel|tv)\/([^/?#]+)/)?.[1] ?? null,
		creatorSelector: 'header a[href^="/"], article header a[href^="/"]',
		tagSelector: 'a[href*="/explore/tags/"]'
	});
}

function extractTumblr(document: Document, context: LiveMetadataContext): SourceCaptureRecord {
	return enhanceGeneric(extractGeneric(document, context), 'tumblr', context, {
		postId: context.pageUrl.match(/\/post\/(\d+)/)?.[1] ?? null,
		creatorSelector: 'a[data-testid*="blog"], header a[href], article header a[href]',
		tagSelector: 'a[data-testid="tag-link"], a[href*="/tagged/"]'
	});
}

function extractX(document: Document, context: LiveMetadataContext): SourceCaptureRecord {
	return enhanceGeneric(extractGeneric(document, context), 'x', context, {
		postId: context.pageUrl.match(/\/status\/(\d+)/)?.[1] ?? null,
		creatorSelector: 'article [data-testid="User-Name"] a[href^="/"]',
		tagSelector: 'article a[href*="/hashtag/"]'
	});
}

function extractLofter(document: Document, context: LiveMetadataContext): SourceCaptureRecord {
	return enhanceGeneric(extractGeneric(document, context), 'lofter', context, {
		postId: context.pageUrl.match(/\/post\/([a-zA-Z0-9]+)/)?.[1] ?? null,
		creatorSelector: 'a[href*=".lofter.com"][class*="blog"], header a[href*=".lofter.com"]',
		tagSelector: 'a[href*="/tag/"], a[href*="/tagged/"]'
	});
}

function extractVk(document: Document, context: LiveMetadataContext): SourceCaptureRecord {
	return enhanceGeneric(extractGeneric(document, context), 'vk', context, {
		postId: context.pageUrl.match(/photo(-?\d+_\d+)|wall(-?\d+_\d+)/)?.[1] ?? null,
		creatorSelector: 'a.author, a[href*="/id"], a[href*="/club"], a[href*="/public"]',
		tagSelector: 'a[href*="/feed?section=search"], a[href*="?q=%23"]'
	});
}

function extractWeibo(document: Document, context: LiveMetadataContext): SourceCaptureRecord {
	return enhanceGeneric(extractGeneric(document, context), 'weibo', context, {
		postId: context.pageUrl.match(/\/(?:detail\/)?([A-Za-z0-9]{8,})/)?.[1] ?? null,
		creatorSelector: 'a[href*="/u/"], a[href*="/n/"], [class*="head"] a[href]',
		tagSelector: 'a[href*="/weibo?q=%23"], a[href*="/topic/"]'
	});
}

function enhanceGeneric(
	record: SourceCaptureRecord,
	adapterId: SourceTag['source'],
	context: LiveMetadataContext,
	options: {
		postId: string | null;
		creatorSelector: string;
		tagSelector: string;
	}
): SourceCaptureRecord {
	const container = closestPostContainer(context.targetElement) ?? document.body;
	const creators = linksAsCreators(container, options.creatorSelector, {
		role: 'artist',
		pageUrl: context.pageUrl
	});
	const sourceTags = uniqueTags([
		...record.sourceTags.filter((tag) => tag.source !== 'generic'),
		...[...container.querySelectorAll<HTMLAnchorElement>(options.tagSelector)].flatMap((anchor) => {
			const label = cleanText(anchor.textContent)?.replace(/^#|#$/g, '');
			return label
				? [
						sourceTag(
							adapterId,
							adapterId === 'x' || adapterId === 'instagram' ? 'hashtag' : 'tag',
							label,
							anchor.href,
							options.tagSelector,
							'high'
						)
					]
				: [];
		})
	]);
	return {
		...record,
		adapterId,
		sourcePostId: options.postId,
		creators: creators.length ? mergeCreators(creators, record.creators) : record.creators,
		sourceTags
	};
}

function recordFromStructuredData(
	objects: unknown[],
	context: LiveMetadataContext
): SourceCaptureRecord {
	const object =
		findObject(objects, (entry) => {
			const type = stringValue(entry['@type'])?.toLowerCase();
			return Boolean(
				type && /(image|visualart|photograph|socialmediapost|creativework)/.test(type)
			);
		}) ?? null;
	const creators = object
		? structuredCreators(object.author ?? object.creator, context.pageUrl)
		: [];
	const images = object
		? imageValues(object.image ?? object.contentUrl ?? object.thumbnailUrl)
		: [];
	return finalizeRecord({
		adapterId: 'json_ld',
		canonicalPostUrl:
			stringValue(object?.url) ?? metaContent(document, 'property', 'og:url') ?? context.pageUrl,
		sourcePostId: stringValue(object?.identifier),
		title: provenanced(
			stringValue(object?.name) ?? stringValue(object?.headline),
			'json_ld',
			'@type name'
		),
		description: provenanced(stringValue(object?.description), 'json_ld', '@type description'),
		publishedAt: provenanced(
			stringValue(object?.datePublished) ?? stringValue(object?.uploadDate),
			'json_ld',
			'@type date'
		),
		creators,
		media: images.map((url, index) =>
			mediaItem({
				sourceMediaId: null,
				ordinal: index,
				originalUrl: absoluteUrl(url, context.pageUrl),
				previewUrl: index === 0 ? context.imageUrl : null,
				width: null,
				height: null,
				mimeType: mimeFromUrl(url),
				altText: null,
				kind: 'image',
				referrer: context.pageUrl,
				provenance: 'json_ld'
			})
		),
		sourceTags: [],
		sensitivity: null,
		rights: null,
		extractedAt: new Date().toISOString()
	});
}

function mediaFromContainer(
	container: ParentNode,
	context: LiveMetadataContext,
	provenance: MetadataProvenance
): SourceMedia[] {
	const images = [...container.querySelectorAll<HTMLImageElement>('img')];
	const meaningful = images.filter((image) => isMeaningfulImage(image));
	const selected = meaningful.filter((image) => isSameImage(image, context.imageUrl));
	const scoped = selected.length
		? [...selected, ...meaningful.filter((image) => !selected.includes(image))].slice(0, 20)
		: meaningful.slice(0, 20);
	const media = scoped.map((image, index) => {
		const original =
			image.dataset.original ??
			image.dataset.fullSrc ??
			image.dataset.fullviewSrc ??
			image.dataset.src ??
			image.closest<HTMLAnchorElement>('a[href]')?.href ??
			image.currentSrc ??
			image.src;
		return mediaItem({
			sourceMediaId: image.dataset.imageId ?? image.dataset.id ?? null,
			ordinal: index,
			originalUrl: original ? absoluteUrl(original, context.pageUrl) : null,
			previewUrl: image.currentSrc || image.src || null,
			width: image.naturalWidth || numberAttribute(image, 'width'),
			height: image.naturalHeight || numberAttribute(image, 'height'),
			mimeType: mimeFromUrl(original),
			altText: image.alt || null,
			kind: /\.gif(?:[?#]|$)/i.test(original ?? '') ? 'animation' : 'image',
			referrer: context.pageUrl,
			provenance
		});
	});
	if (!media.some((entry) => entry.originalUrl === context.imageUrl)) {
		media.unshift(
			mediaItem({
				sourceMediaId: null,
				ordinal: 0,
				originalUrl: context.imageUrl,
				previewUrl: context.imageUrl,
				width: null,
				height: null,
				mimeType: mimeFromUrl(context.imageUrl),
				altText:
					context.targetElement instanceof HTMLImageElement
						? context.targetElement.alt || null
						: null,
				kind: 'image',
				referrer: context.pageUrl,
				provenance
			})
		);
	}
	return uniqueMedia(media).map((entry, index) => ({ ...entry, ordinal: index }));
}

function genericCreators(container: ParentNode, pageUrl: string): SourceCreator[] {
	const scope =
		container.querySelector<ParentNode>(
			'[class*="credit"], [class*="artist"], [class*="author"], [class*="byline"], header'
		) ?? container;
	return linksAsCreators(
		scope,
		'a[rel~="author"], a[itemprop="author"], a[href*="/user/"], a[href*="/users/"], a[href]',
		{
			role: 'artist',
			pageUrl,
			allow: (url) => new URL(url).origin === new URL(pageUrl).origin
		}
	).slice(0, 8);
}

function linksAsCreators(
	container: ParentNode,
	selector: string,
	options: {
		role: SourceCreatorRole;
		pageUrl: string;
		allow?: (url: string) => boolean;
	}
): SourceCreator[] {
	const creators = [...container.querySelectorAll<HTMLAnchorElement>(selector)].flatMap(
		(anchor) => {
			const profileUrl = absoluteUrl(anchor.getAttribute('href') ?? anchor.href, options.pageUrl);
			const displayName =
				cleanText(anchor.getAttribute('aria-label')) ??
				cleanText(anchor.textContent) ??
				cleanText(anchor.getAttribute('title'));
			if (!profileUrl || !displayName || displayName.length > 100) return [];
			if (options.allow && !options.allow(profileUrl)) return [];
			return [
				creator({
					role: options.role,
					displayName,
					username: usernameFromUrl(profileUrl),
					profileUrl,
					sourceId: anchor.dataset.userId ?? anchor.dataset.id ?? null,
					confidence: 'medium',
					provenance: 'dom',
					evidence: selector
				})
			];
		}
	);
	return mergeCreators(creators, []);
}

function genericTags(container: ParentNode, source: SourceTag['source']): SourceTag[] {
	return uniqueTags(
		[...container.querySelectorAll<HTMLAnchorElement>('a[rel~="tag"], a[href*="/tag/"]')].flatMap(
			(anchor) => {
				const label = cleanText(anchor.textContent);
				return label
					? [sourceTag(source, 'tag', label, anchor.href, 'rel=tag or tag URL', 'medium')]
					: [];
			}
		)
	);
}

function pixivTags(illust: Record<string, unknown> | null, container: ParentNode): SourceTag[] {
	const embeddedTags = Array.isArray(nestedValue(illust, ['tags', 'tags']))
		? (nestedValue(illust, ['tags', 'tags']) as unknown[])
		: [];
	const fromEmbedded = embeddedTags.flatMap((value) => {
		if (typeof value === 'string') {
			return [sourceTag('pixiv', 'tag', value, null, 'Pixiv artwork data', 'high')];
		}
		if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
		const tag = stringValue((value as Record<string, unknown>).tag);
		const translated = stringValue((value as Record<string, unknown>).translation);
		if (!tag) return [];
		return [
			{
				...sourceTag(
					'pixiv',
					'tag',
					tag,
					`https://www.pixiv.net/tags/${encodeURIComponent(tag)}/artworks`,
					'Pixiv artwork data',
					'high'
				),
				label:
					translated && translated.toLowerCase() !== tag.toLowerCase()
						? `${tag} · ${translated}`
						: tag
			}
		];
	});
	const fromDom = [...container.querySelectorAll<HTMLAnchorElement>('a[href*="/tags/"]')].flatMap(
		(anchor) => {
			const label = cleanText(anchor.textContent)?.replace(/^#/, '');
			return label
				? [sourceTag('pixiv', 'tag', label, anchor.href, 'a[href*="/tags/"]', 'high')]
				: [];
		}
	);
	return uniqueTags([...fromEmbedded, ...fromDom]);
}

function structuredCreators(value: unknown, pageUrl: string): SourceCreator[] {
	const values = Array.isArray(value) ? value : value ? [value] : [];
	return values.flatMap((entry) => {
		if (typeof entry === 'string') {
			return [
				creator({
					role: 'artist',
					displayName: entry,
					username: null,
					profileUrl: null,
					sourceId: null,
					confidence: 'medium',
					provenance: 'json_ld',
					evidence: 'author'
				})
			];
		}
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
		const object = entry as Record<string, unknown>;
		const name = stringValue(object.name);
		if (!name) return [];
		const url = absoluteUrl(stringValue(object.url), pageUrl);
		return [
			creator({
				role: 'artist',
				displayName: name,
				username: usernameFromUrl(url),
				profileUrl: url,
				sourceId: stringValue(object.identifier),
				confidence: 'high',
				provenance: 'json_ld',
				evidence: 'author'
			})
		];
	});
}

function sensitivityFromDocument(document: Document): SourceSensitivity | null {
	const value =
		metaContent(document, 'property', 'og:restrictions:age') ??
		metaContent(document, 'name', 'rating') ??
		metaContent(document, 'name', 'twitter:label1');
	if (!value) return null;
	return {
		level: /explicit|adult|18\+|r-18/i.test(value)
			? 'explicit'
			: /mature|sensitive|nsfw/i.test(value)
				? 'sensitive'
				: 'unknown',
		label: value,
		provenance: 'generic'
	};
}

function rightsFromDocument(document: Document): SourceCaptureRecord['rights'] {
	const label =
		metaContent(document, 'name', 'copyright') ??
		metaContent(document, 'property', 'og:copyright') ??
		cleanText(
			document.querySelector<HTMLElement>(
				'[rel="license"], [itemprop="license"], [class*="copyright"], [class*="license"]'
			)?.textContent
		);
	const link =
		document.querySelector<HTMLAnchorElement>('a[rel="license"], a[itemprop="license"]')?.href ??
		null;
	return label ? { label, url: link, provenance: 'generic' } : null;
}

function finalizeRecord(record: SourceCaptureRecord): SourceCaptureRecord {
	return {
		...record,
		canonicalPostUrl: record.canonicalPostUrl || location.href,
		creators: mergeCreators(record.creators, []),
		media: uniqueMedia(record.media).map((entry, index) => ({ ...entry, ordinal: index })),
		sourceTags: uniqueTags(record.sourceTags)
	};
}

function closestPostContainer(element: Element | null): HTMLElement | null {
	if (!element) return null;
	const selectors = [
		'article',
		'[role="article"]',
		'[data-testid*="post"]',
		'[data-post-id]',
		'[class*="submission"]',
		'[class*="artwork"]',
		'[class*="post"]',
		'figure',
		'[role="dialog"]'
	];
	for (const selector of selectors) {
		const match = element.closest<HTMLElement>(selector);
		if (match && match.textContent && match.textContent.trim().length < 200_000) return match;
	}
	return element.parentElement;
}

function closestCanonicalLink(element: Element | null, pageUrl: string): string | null {
	const href = element?.closest<HTMLAnchorElement>('a[href]')?.href;
	if (!href) return null;
	try {
		const url = new URL(href, pageUrl);
		if (!['http:', 'https:'].includes(url.protocol)) return null;
		return url.toString();
	} catch {
		return null;
	}
}

function embeddedObjects(document: Document): unknown[] {
	const objects = structuredObjects(document);
	const preload = document.querySelector<HTMLMetaElement>(
		'meta#meta-preload-data, meta[name="preload-data"]'
	)?.content;
	if (preload && preload.length <= 4_000_000) {
		try {
			objects.push(JSON.parse(preload));
		} catch {
			// Some pages HTML-escape or omit preload data. DOM extraction remains available.
		}
	}
	return objects;
}

function structuredObjects(document: Document): unknown[] {
	const output: unknown[] = [];
	const scripts = [
		...document.querySelectorAll<HTMLScriptElement>(
			'script[type="application/ld+json"], script[type="application/json"], script#__NEXT_DATA__'
		)
	].slice(0, 30);
	for (const script of scripts) {
		const value = script.textContent?.trim();
		if (!value || value.length > 4_000_000) continue;
		try {
			output.push(JSON.parse(value));
		} catch {
			// Embedded state is optional and frequently contains non-JSON wrappers.
		}
	}
	return output;
}

function findObject(
	values: unknown[],
	predicate: (entry: Record<string, unknown>) => boolean
): Record<string, unknown> | null {
	const queue = values.map((value) => ({ value, depth: 0 }));
	let visited = 0;
	while (queue.length && visited < 20_000) {
		const current = queue.shift()!;
		visited += 1;
		if (!current.value || typeof current.value !== 'object') continue;
		if (Array.isArray(current.value)) {
			if (current.depth < 10) {
				for (const entry of current.value.slice(0, 1_000)) {
					queue.push({ value: entry, depth: current.depth + 1 });
				}
			}
			continue;
		}
		const object = current.value as Record<string, unknown>;
		if (predicate(object)) return object;
		if (current.depth >= 10) continue;
		for (const value of Object.values(object)) {
			queue.push({ value, depth: current.depth + 1 });
		}
	}
	return null;
}

function imageValues(value: unknown): string[] {
	if (typeof value === 'string') return [value];
	if (Array.isArray(value)) return value.flatMap(imageValues).slice(0, 100);
	if (!value || typeof value !== 'object') return [];
	const object = value as Record<string, unknown>;
	return imageValues(object.url ?? object.contentUrl ?? object.thumbnailUrl ?? []);
}

function provenanced<T>(
	value: T | null | undefined,
	provenance: MetadataProvenance,
	evidence: string
): ProvenancedValue<T> | null {
	return value === null || value === undefined ? null : { value, provenance, evidence };
}

function creator(value: SourceCreator): SourceCreator {
	return value;
}

function mediaItem(value: SourceMedia): SourceMedia {
	return value;
}

function sourceTag(
	source: SourceTag['source'],
	category: SourceTag['category'],
	label: string,
	url: string | null,
	selectorHint: string,
	confidence: CandidateConfidence
): SourceTag {
	return {
		source,
		category,
		label,
		slug: normalizeTag(label),
		url,
		confidence,
		selectorHint
	};
}

function mergeCreators(first: SourceCreator[], second: SourceCreator[]): SourceCreator[] {
	const byIdentity = new Map<string, SourceCreator>();
	for (const entry of [...first, ...second]) {
		const key = (
			entry.profileUrl ?? `${entry.role}:${entry.username ?? entry.displayName}`
		).toLowerCase();
		const existing = byIdentity.get(key);
		if (!existing || confidenceRank(entry.confidence) > confidenceRank(existing.confidence)) {
			byIdentity.set(key, entry);
		}
	}
	return [...byIdentity.values()].slice(0, 20);
}

function uniqueMedia(media: SourceMedia[]): SourceMedia[] {
	const seen = new Set<string>();
	return media.filter((entry) => {
		const key = entry.originalUrl ?? entry.previewUrl ?? entry.sourceMediaId;
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function mergeMedia(first: SourceMedia[], second: SourceMedia[]): SourceMedia[] {
	return uniqueMedia([...first, ...second]);
}

function uniqueTags(tags: SourceTag[]): SourceTag[] {
	const seen = new Set<string>();
	return tags
		.filter((tag) => {
			const key = `${tag.source}:${tag.category}:${tag.slug}`;
			if (!tag.slug || seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.slice(0, 250);
}

function confidenceRank(value: CandidateConfidence): number {
	return value === 'high' ? 3 : value === 'medium' ? 2 : 1;
}

function textFrom(container: ParentNode, selectors: string[]): string | null {
	for (const selector of selectors) {
		const value = cleanText(container.querySelector(selector)?.textContent);
		if (value) return value;
	}
	return null;
}

function attributeFrom(
	container: ParentNode,
	selectors: string[],
	attribute: string
): string | null {
	for (const selector of selectors) {
		const value = cleanText(container.querySelector(selector)?.getAttribute(attribute));
		if (value) return value;
	}
	return null;
}

function hrefFrom(container: ParentNode, selectors: string[]): string | null {
	for (const selector of selectors) {
		const value = container.querySelector<HTMLAnchorElement>(selector)?.href;
		if (value) return value;
	}
	return null;
}

function metaContent(
	document: Document,
	attribute: 'name' | 'property',
	value: string
): string | null {
	return cleanText(
		document.querySelector<HTMLMetaElement>(`meta[${attribute}="${value}"]`)?.content
	);
}

function cleanText(value: string | null | undefined): string | null {
	const cleaned = value?.replace(/\s+/g, ' ').trim();
	return cleaned ? cleaned.slice(0, 20_000) : null;
}

function cleanHtml(value: string | null): string | null {
	if (!value) return null;
	return cleanText(new DOMParser().parseFromString(value, 'text/html').body.textContent);
}

function hostname(value: string): string {
	try {
		return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
	} catch {
		return '';
	}
}

function hostMatches(domain: string): (host: string) => boolean {
	return (host) => host === domain || host.endsWith(`.${domain}`);
}

function absoluteUrl(value: string | null | undefined, base: string): string | null {
	if (!value) return null;
	try {
		return new URL(value, base).toString();
	} catch {
		return null;
	}
}

function usernameFromUrl(value: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		if (url.hostname.endsWith('.tumblr.com')) return url.hostname.split('.')[0] ?? null;
		const segment = url.pathname
			.split('/')
			.map((entry) =>
				decodeURIComponent(entry)
					.replace(/^[@~]+/, '')
					.trim()
			)
			.find(Boolean);
		return segment ?? null;
	} catch {
		return null;
	}
}

function normalizeTag(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/^#/, '')
		.replace(/&/g, ' and ')
		.replace(/['"]/g, '')
		.replace(/[^a-z0-9\u00c0-\u024f\u3040-\u30ff\u3400-\u9fff]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

function nestedValue(object: Record<string, unknown> | null, path: string[]): unknown {
	let value: unknown = object;
	for (const key of path) {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
		value = (value as Record<string, unknown>)[key];
	}
	return value;
}

function nestedString(object: Record<string, unknown> | null, path: string[]): string | null {
	return stringValue(nestedValue(object, path));
}

function stringValue(value: unknown): string | null {
	if (typeof value === 'string') return cleanText(value);
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	return null;
}

function numberValue(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
		return Number(value);
	}
	return null;
}

function numberAttribute(element: Element, name: string): number | null {
	return numberValue(element.getAttribute(name));
}

function mimeFromUrl(value: string | null | undefined): string | null {
	if (!value) return null;
	const path = value.split(/[?#]/)[0]?.toLowerCase() ?? '';
	if (path.endsWith('.png')) return 'image/png';
	if (path.endsWith('.gif')) return 'image/gif';
	if (path.endsWith('.webp')) return 'image/webp';
	if (path.endsWith('.avif')) return 'image/avif';
	if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
	return null;
}

function pixivPageUrl(url: string, index: number): string {
	return url.replace(/_p\d+(?=\.[a-z0-9]+(?:[?#]|$))/i, `_p${index}`);
}

function isMeaningfulImage(image: HTMLImageElement): boolean {
	const width = image.naturalWidth || image.width || image.offsetWidth;
	const height = image.naturalHeight || image.height || image.offsetHeight;
	if (Math.max(width, height) < 120) return false;
	const value = `${image.currentSrc} ${image.src} ${image.className} ${image.alt}`.toLowerCase();
	return !/\b(avatar|emoji|icon|logo|badge|sprite|reaction)\b/.test(value);
}

function isSameImage(image: HTMLImageElement, imageUrl: string): boolean {
	return [image.currentSrc, image.src, image.dataset.original, image.dataset.fullSrc].some(
		(value) => value && (value === imageUrl || stripUrl(value) === stripUrl(imageUrl))
	);
}

function stripUrl(value: string): string {
	try {
		const url = new URL(value, location.href);
		url.hash = '';
		return url.toString();
	} catch {
		return value;
	}
}

function cssEscape(value: string): string {
	if (globalThis.CSS?.escape) return globalThis.CSS.escape(value);
	return value.replace(/["\\]/g, '\\$&');
}

function isUniqueSelector(selector: string, document: Document): boolean {
	try {
		return document.querySelectorAll(selector).length === 1;
	} catch {
		return false;
	}
}
