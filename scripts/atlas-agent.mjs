#!/usr/bin/env node
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULT_BASE_URL = 'http://localhost:5173';
const DEFAULT_NANOGPT_BASE_URL = 'https://nano-gpt.com/api/v1';
const DEFAULT_MODEL_ENDPOINT = 'https://nano-gpt.com/api/subscription/v1/models?detailed=true';
const DEFAULT_LEDGER_PATH = join('.pastiche', 'exports', 'agent-runs', 'token-ledger.jsonl');
const DEFAULT_WEEKLY_TOKEN_BUDGET = 30_000_000;
const DEFAULT_WARN_AT_TOKENS = 25_000_000;
const DEFAULT_BLOCKED_MODEL_PATTERNS = ['\\bx2\\b', 'x2 subscription', 'subscription x2'];
const MODEL_TIERS = {
	routineText: [
		'zai-org/glm-5',
		'deepseek/deepseek-v3.2',
		'zai-org/glm-4.7',
		'deepseek/deepseek-v4-pro-cheaper',
		'deepseek/deepseek-v4-flash',
		'google/gemma-4-31b-it'
	],
	deeperText: [
		'moonshotai/kimi-k2.5:thinking',
		'deepseek/deepseek-v4-pro-cheaper:thinking',
		'moonshotai/kimi-k2.6:thinking',
		'minimax/minimax-m3:thinking',
		'google/gemma-4-31b-it:thinking'
	],
	visionSweep: [
		'minimax/minimax-m3',
		'xiaomi/mimo-v2.5',
		'moonshotai/kimi-k2.5',
		'zai-org/glm-4.6v',
		'Gemma-4-31B-Claude-4.6-Opus-Reasoning-Distilled',
		'meta-llama/llama-4-maverick'
	],
	visionFallback: ['xiaomi/mimo-v2.5:thinking', 'qwen25-vl-72b-instruct']
};
const DEFAULT_ALLOWED_MODELS = [...new Set(Object.values(MODEL_TIERS).flat())];
const DEFAULT_MODEL_BY_JOB = {
	'asset-tagging': 'zai-org/glm-5',
	'wiki-draft': 'zai-org/glm-5',
	'vocabulary-audit': 'deepseek/deepseek-v3.2',
	'json-repair': 'deepseek/deepseek-v4-flash',
	'vision-sweep': 'minimax/minimax-m3'
};

const JOBS = new Map([
	[
		'vision-sweep',
		{
			name: 'vision-sweep',
			responseName: 'Atlas visible-content JSON',
			instructions: [
				'Return only strict JSON. Do not include Markdown, prose, code fences, commentary, or headings.',
				'The JSON must be an Atlas visible-content object with these top-level keys only: annotations, notes.',
				'Tag only what is visible in the image. Do not add art-historical interpretation, provenance, artist, title, date, institution, or source metadata.',
				'Use annotations for visible figures, animals, objects, settings, and important visual regions.',
				'Each annotation must use this shape: { "label": string, "concepts": string[], "classifiers": object, "note"?: string }.',
				'Use classifiers on annotations for visual_role, position, pose, view, color, material, pattern, state, action, and scale when directly visible.',
				'Allowed visual_role values: focal_point, supporting_subject, background_detail, setting_context.',
				'Prefer existing simple entity/object concepts over compound tags. Use classifiers instead of tags for color, pose, position, state, material, and visual role.',
				'For a dark or black background, use concept background with classifiers exactly like visual_role: setting_context, color: black, value: dark, and state: shadowed. Do not create dark_background and do not use prose colors like dark brown for background.',
				'Do not infer identity from context. For example, return female_figure rather than Olympia unless the context packet explicitly asks for named identity.',
				'Do not include source-keyword guesses. Only visible content belongs in this pass.',
				'Do not include status fields in vision-sweep annotations.',
				'Do not tag signatures, watermarks, labels, inscriptions, or visible text unless OCR/text analysis is explicitly requested or the text is a focal part of the image.'
			]
		}
	],
	[
		'asset-tagging',
		{
			name: 'asset-tagging',
			responseName: 'Atlas batch JSON',
			instructions: [
				'Return only strict JSON. Do not include Markdown, prose, code fences, commentary, or headings.',
				'The JSON must be an Atlas batch object with these optional top-level keys only: identity, concepts, entities, claims, annotations.',
				'Use existing canonical slugs whenever they fit.',
				'Use underscore slugs only. Never use hyphenated slugs.',
				'Use status approved only when the exact slug is present in the context packet Relevant Vocabulary as an existing canonical/active concept. Otherwise use needs_review or suggested.',
				'If the context packet has no explicit section named Relevant Vocabulary, do not use status approved for any concept or entity.',
				'Source metadata tags, current image labels, generated vision labels, and museum keyword lists are not Relevant Vocabulary.',
				'Approved means the concept already exists in Pastiche Atlas, not that you are confident. Confidence alone never makes a new tag approved.',
				'If a useful new tag is required, use it with status needs_review and include enough context for a later wiki draft. Do not avoid useful new tags just because they are new.',
				'Do not mark new tags or new entities approved.',
				'Do not manually add broad parent tags when implications can handle them.',
				'Do not add classifiers to asset-level concepts. Put classifiers on annotations.',
				'Each annotation must use this shape: { "label": string, "concepts": string[], "classifiers": object, "note"?: string }. Do not put classifier fields directly on the annotation.',
				'Every annotation should have at least one concept. For a dark or black background, use concept background with classifiers exactly like visual_role: setting_context, color: black, value: dark, and state: shadowed. Do not create dark_background or prose color values like dark brown.',
				'Do not create vague annotation labels without concepts. If the model cannot name the visible thing, use a broader concept such as figure, creature, object, ornament, or background with a note.',
				'Every source_metadata or technical_metadata claim should have a concise label.',
				'Separate observed, metadata, inferred, interpretive, prompted, and computed evidence.',
				'Do not convert every named person, artwork, event, or institution in a source description into an entity. Create entities only for the creator, source/holding institution, depicted/named subject, rights/source entity, or a context entity the user explicitly needs. Put other source-description names into claims only when relevant.',
				'Source-provided keyword tags are suggestions, not automatic canonical concepts. Include them only when visible, central to the work, or clearly useful for retrieval.',
				'Do not tag signatures, watermarks, labels, inscriptions, or visible text unless OCR/text analysis is explicitly requested or the text is a focal part of the image.'
			]
		}
	],
	[
		'wiki-draft',
		{
			name: 'wiki-draft',
			responseName: 'Atlas wiki draft JSON',
			instructions: [
				'Return only strict JSON. Do not include Markdown, prose, code fences, commentary, or headings.',
				'Return an object with an entries array.',
				'Each entry must include slug, label, kind, category, displayGroup, shortDefinition, useWhen, doNotUseWhen, aiGuidance, status, and maturity.',
				'Use status needs_review and maturity draft unless the packet explicitly says otherwise.',
				'Include aliases, broader, narrower, related, confusable, automaticImplications, suggestedImplications, allowedClassifiers, and citations as arrays.',
				'Use concise factual prose. Do not over-explain.',
				'Do not invent citations. If no citation is supplied, leave citations empty.'
			]
		}
	],
	[
		'vocabulary-audit',
		{
			name: 'vocabulary-audit',
			responseName: 'Atlas vocabulary audit JSON',
			instructions: [
				'Return only strict JSON. Do not include Markdown, prose, code fences, commentary, or headings.',
				'Return an object with duplicateCandidates, aliasCandidates, distinctButConfusable, implicationCandidates, and notes arrays.',
				'Nearby concepts are not necessarily duplicates. Explain why each candidate is or is not mergeable.',
				'Do not recommend merging concepts that differ by evidence type, domain, or retrieval use.'
			]
		}
	],
	[
		'json-repair',
		{
			name: 'json-repair',
			responseName: 'Repaired Atlas JSON',
			instructions: [
				'Return only strict JSON. Do not include Markdown, prose, code fences, commentary, or headings.',
				'Repair the provided Atlas JSON so it is parseable and follows the requested schema.',
				'Do not add new facts or tags while repairing.',
				'Preserve user intent when possible.',
				'Use underscore slugs only. Convert hyphenated slugs to underscores.',
				'Downgrade approved status to needs_review unless the context explicitly proves the slug/entity is existing canonical vocabulary.',
				'If no Relevant Vocabulary section is supplied, downgrade all approved concept/entity statuses to needs_review.',
				'Each annotation must use concepts: string[] and classifiers: object. Move visual_role, position, pose, view, color, material, pattern, state, action, scale, and shape into classifiers.',
				'Every annotation should have at least one concept. Use background with classifiers for dark or black backgrounds.',
				'For background annotations, prefer concept background plus classifiers visual_role: setting_context, color: black, value: dark, and state: shadowed instead of dark_background or prose-only color labels.'
			]
		}
	]
]);

async function main() {
	await loadLocalEnv();
	const args = parseArgs(process.argv.slice(2));
	if (args.help || process.argv.length <= 2) {
		printHelp();
		return;
	}
	if (args['usage-summary']) {
		await printUsageSummary(args);
		return;
	}
	if (args['list-model-tiers']) {
		printModelTiers();
		return;
	}
	if (args['list-models']) {
		await listModels(args);
		return;
	}

	const apiKey = process.env.NANOGPT_API_KEY;
	if (!apiKey) fail('NANOGPT_API_KEY is required.');

	const jobName = stringArg(args.job, 'asset-tagging');
	const job = JOBS.get(jobName);
	if (!job) fail(`Unknown job "${jobName}". Use one of: ${[...JOBS.keys()].join(', ')}`);
	const model = resolveModelSelection({
		requestedModel: stringArg(args.model, ''),
		jobName,
		tier: optionalString(args['model-tier'])
	});
	if (!model) fail('--model is required.');
	const configuredAllowedModels = listArg(args['allowed-models'], process.env.ATLAS_ALLOWED_MODELS);
	const modelCheck = await checkModelAccess({
		apiKey,
		model,
		modelsUrl: stringArg(args['models-url'], DEFAULT_MODEL_ENDPOINT),
		freeOnly: booleanArg(args['free-only'], true),
		allowedModels: configuredAllowedModels.length
			? configuredAllowedModels
			: DEFAULT_ALLOWED_MODELS,
		blockedPatterns: listArg(
			args['blocked-model-patterns'],
			process.env.ATLAS_BLOCKED_MODEL_PATTERNS
		).concat(DEFAULT_BLOCKED_MODEL_PATTERNS),
		allowUnknownModel: booleanArg(args['allow-unknown-model'], false)
	});

	const packet = await loadPacket(args);
	const context = clampContext(packet.text, numberArg(args['max-context-chars'], 60000));
	const prompt = buildPrompt(job, context, {
		source: packet.source,
		extra: stringArg(args.extra, '')
	});
	const imageInput = await loadImageInput(args, { jobName: job.name });
	const promptChars = prompt.system.length + prompt.user.length;
	const estimatedPromptTokens = estimateTokens(`${prompt.system}\n${prompt.user}`);
	const maxTokens = numberArg(args['max-tokens'], 4096);
	printTokenPreflight({
		model,
		job: job.name,
		promptChars,
		estimatedPromptTokens,
		maxTokens,
		modelCheck
	});
	const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${job.name}-${randomUUID().slice(0, 8)}`;
	const outDir = resolve(stringArg(args.out, join('.pastiche', 'exports', 'agent-runs', runId)));
	await mkdir(outDir, { recursive: true });
	await writeFile(join(outDir, 'prompt.txt'), prompt.user, 'utf8');
	await writeFile(join(outDir, 'system.txt'), prompt.system, 'utf8');

	const userMessage = imageInput
		? {
				role: 'user',
				content: [
					{ type: 'text', text: prompt.user },
					{ type: 'image_url', image_url: { url: imageInput.url } }
				]
			}
		: { role: 'user', content: prompt.user };
	let response;
	try {
		response = await callNanoGpt({
			apiKey,
			model,
			messages: [{ role: 'system', content: prompt.system }, userMessage],
			temperature: numberArg(args.temperature, 0.1),
			maxTokens,
			reasoningEffort: optionalString(args['reasoning-effort']),
			reasoningExclude: booleanArg(args['reasoning-exclude'], true),
			baseUrl: stringArg(args['nanogpt-base-url'], DEFAULT_NANOGPT_BASE_URL)
		});
	} catch (error) {
		const failureMessage = formatError(error);
		await writeFile(join(outDir, 'request-error.txt'), failureMessage, 'utf8');
		const usageRecord = buildUsageRecord({
			args,
			runId,
			outDir,
			model,
			job: job.name,
			packetSource: packet.source,
			promptChars,
			responseChars: 0,
			estimatedPromptTokens,
			estimatedCompletionTokens: maxTokens,
			maxTokens,
			response: null,
			modelCheck,
			status: 'failed',
			error: failureMessage
		});
		if (imageInput) {
			usageRecord.image = {
				source: imageInput.source,
				mimeType: imageInput.mimeType,
				bytes: imageInput.bytes
			};
		}
		await writeFile(join(outDir, 'usage.json'), JSON.stringify(usageRecord, null, 2), 'utf8');
		await appendUsageRecord(args, usageRecord);
		throw error;
	}
	const text = response.choices?.[0]?.message?.content ?? '';
	await writeFile(join(outDir, 'response.raw.txt'), text, 'utf8');
	await writeFile(join(outDir, 'response.full.json'), JSON.stringify(response, null, 2), 'utf8');

	const extracted = extractJson(text);
	if (extracted) {
		await writeFile(
			join(outDir, 'response.extracted.json'),
			JSON.stringify(extracted, null, 2),
			'utf8'
		);
	} else {
		await writeFile(
			join(outDir, 'response.extract-error.txt'),
			'No parseable JSON object found.',
			'utf8'
		);
	}
	const usageRecord = buildUsageRecord({
		args,
		runId,
		outDir,
		model,
		job: job.name,
		packetSource: packet.source,
		promptChars,
		responseChars: text.length,
		estimatedPromptTokens,
		estimatedCompletionTokens: estimateTokens(text),
		maxTokens,
		response,
		modelCheck,
		status: 'succeeded'
	});
	if (imageInput) {
		usageRecord.image = {
			source: imageInput.source,
			mimeType: imageInput.mimeType,
			bytes: imageInput.bytes
		};
	}
	await writeFile(join(outDir, 'usage.json'), JSON.stringify(usageRecord, null, 2), 'utf8');
	await appendUsageRecord(args, usageRecord);

	console.log(`Atlas agent run saved: ${outDir}`);
	console.log(`Model: ${model}`);
	console.log(`Job: ${job.name}`);
	console.log(`Prompt chars: ${promptChars}`);
	console.log(`Tokens: ${formatUsageLine(usageRecord)}`);
	console.log(`Response chars: ${text.length}`);
	console.log(`Extracted JSON: ${extracted ? 'yes' : 'no'}`);
	printBudgetWarning(args, usageRecord);
}

function buildPrompt(job, context, options) {
	const system = [
		'You are a Pastiche Atlas batch processor.',
		'You are not participating in a chat.',
		'You perform one bounded metadata task and return the requested machine-readable JSON only.',
		'Follow the supplied Atlas vocabulary and agent rules exactly.',
		'When uncertain, use needs_review or suggested rather than inventing certainty.'
	].join('\n');
	const user = [
		`Task: ${job.name}`,
		`Required response: ${job.responseName}`,
		'',
		'Rules:',
		...job.instructions.map((line) => `- ${line}`),
		options.extra ? `- Extra user instruction: ${options.extra}` : '',
		'',
		`Context source: ${options.source}`,
		'',
		'Context packet:',
		'<<<PASTICHE_ATLAS_CONTEXT',
		context,
		'PASTICHE_ATLAS_CONTEXT>>>'
	]
		.filter(Boolean)
		.join('\n');
	return { system, user };
}

function resolveModelSelection(input) {
	if (input.requestedModel && input.requestedModel !== 'auto') return input.requestedModel;
	if (input.tier) {
		const models = MODEL_TIERS[input.tier];
		if (!models)
			fail(
				`Unknown model tier "${input.tier}". Use one of: ${Object.keys(MODEL_TIERS).join(', ')}`
			);
		return models[0];
	}
	if (input.requestedModel === 'auto')
		return DEFAULT_MODEL_BY_JOB[input.jobName] ?? MODEL_TIERS.routineText[0];
	return '';
}

async function loadPacket(args) {
	const packetPath = optionalString(args.packet);
	if (packetPath) {
		const resolved = resolve(packetPath);
		return { source: resolved, text: await readFile(resolved, 'utf8') };
	}
	const assetId = optionalString(args.asset);
	if (assetId) {
		const baseUrl = stringArg(args['base-url'], DEFAULT_BASE_URL).replace(/\/$/, '');
		const format = stringArg(args.format, 'markdown');
		const url = `${baseUrl}/api/atlas/assets/${encodeURIComponent(assetId)}/context-packet?format=${encodeURIComponent(format)}`;
		return { source: url, text: await fetchText(url) };
	}
	if (args.vocabulary) {
		const baseUrl = stringArg(args['base-url'], DEFAULT_BASE_URL).replace(/\/$/, '');
		const format = stringArg(args.format, 'markdown');
		const url = `${baseUrl}/api/atlas/export/vocabulary?format=${encodeURIComponent(format)}`;
		return { source: url, text: await fetchText(url) };
	}
	fail('Provide --packet <file>, --asset <assetId>, or --vocabulary.');
}

async function loadImageInput(args, options = {}) {
	const imageUrl = optionalString(args['image-url']);
	if (imageUrl) {
		return { source: imageUrl, url: imageUrl, mimeType: null, bytes: null };
	}
	const imageFile = optionalString(args['image-file']);
	if (imageFile) {
		const resolved = resolve(imageFile);
		const bytes = await readFile(resolved);
		const mimeType = mimeTypeForPath(resolved);
		return {
			source: resolved,
			url: `data:${mimeType};base64,${bytes.toString('base64')}`,
			mimeType,
			bytes: bytes.length
		};
	}
	const assetId = optionalString(args.asset);
	if (options.jobName === 'vision-sweep' && assetId && booleanArg(args['image-from-asset'], true)) {
		const baseUrl = stringArg(args['base-url'], DEFAULT_BASE_URL).replace(/\/$/, '');
		const url = `${baseUrl}/api/atlas/assets/${encodeURIComponent(assetId)}/context-packet?format=json`;
		const packet = await fetchJson(url);
		const assetImage =
			packet.asset?.image?.originalUrl ??
			packet.asset?.image?.previewUrl ??
			packet.asset?.image?.sourceImageUrl ??
			null;
		if (!assetImage) return null;
		return imageInputFromUrl(assetImage, baseUrl);
	}
	return null;
}

function mimeTypeForPath(path) {
	const lower = path.toLowerCase();
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
	if (lower.endsWith('.webp')) return 'image/webp';
	if (lower.endsWith('.gif')) return 'image/gif';
	return 'image/png';
}

async function imageInputFromUrl(value, baseUrl) {
	const absoluteUrl = optimizedImageUrl(new URL(value, baseUrl).toString());
	const parsed = new URL(absoluteUrl);
	const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
	if (!local) {
		return { source: absoluteUrl, url: absoluteUrl, mimeType: null, bytes: null };
	}
	const response = await fetch(absoluteUrl);
	if (!response.ok) {
		fail(
			`Could not fetch local asset image ${absoluteUrl}: ${response.status} ${response.statusText}`
		);
	}
	const bytes = Buffer.from(await response.arrayBuffer());
	const mimeType = response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
	return {
		source: absoluteUrl,
		url: `data:${mimeType};base64,${bytes.toString('base64')}`,
		mimeType,
		bytes: bytes.length
	};
}

function optimizedImageUrl(url) {
	return url.replace('/full/full/0/default.jpg', '/full/900,/0/default.jpg');
}

async function fetchText(url) {
	const response = await fetch(url);
	if (!response.ok) fail(`Could not fetch ${url}: ${response.status} ${response.statusText}`);
	return response.text();
}

async function fetchJson(url) {
	const response = await fetch(url);
	const text = await response.text();
	if (!response.ok)
		fail(`Could not fetch ${url}: ${response.status} ${response.statusText}\n${text}`);
	try {
		return JSON.parse(text);
	} catch {
		fail(`Expected JSON from ${url}, got:\n${text.slice(0, 1000)}`);
	}
}

async function callNanoGpt(input) {
	const body = {
		model: input.model,
		messages: input.messages,
		temperature: input.temperature,
		max_tokens: input.maxTokens,
		response_format: { type: 'json_object' }
	};
	if (input.reasoningEffort) body.reasoning_effort = input.reasoningEffort;
	if (input.reasoningExclude) body.reasoning = { exclude: true };

	const response = await fetch(`${input.baseUrl.replace(/\/$/, '')}/chat/completions`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${input.apiKey}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify(body)
	});
	const text = await response.text();
	if (!response.ok)
		fail(`NanoGPT request failed: ${response.status} ${response.statusText}\n${text}`);
	try {
		return JSON.parse(text);
	} catch {
		fail(`NanoGPT returned non-JSON API response:\n${text}`);
	}
}

async function listModels(args) {
	const apiKey = process.env.NANOGPT_API_KEY;
	if (!apiKey) fail('NANOGPT_API_KEY is required.');
	const endpoint = stringArg(args['models-url'], DEFAULT_MODEL_ENDPOINT);
	const response = await fetch(endpoint, {
		headers: { authorization: `Bearer ${apiKey}` }
	});
	const text = await response.text();
	if (!response.ok) fail(`Model list failed: ${response.status} ${response.statusText}\n${text}`);
	const body = JSON.parse(text);
	const models = Array.isArray(body) ? body : (body.data ?? body.models ?? []);
	const query = optionalString(args.q)?.toLowerCase();
	for (const model of models) {
		const id = String(model.id ?? model.model ?? model.name ?? '');
		if (query && !JSON.stringify(model).toLowerCase().includes(query)) continue;
		const context = model.context_length ?? model.contextLength ?? model.max_context_tokens ?? '';
		const vision = modelHasCapability(model, 'vision') ? ' vision' : '';
		const cost = classifyModelCost(model);
		const costLabel =
			cost.status === 'free'
				? ' free'
				: cost.status === 'paid'
					? ' paid'
					: cost.status === 'metered'
						? ' metered'
						: '';
		console.log(`${id}${context ? ` context=${context}` : ''}${vision}${costLabel}`);
	}
}

function printModelTiers() {
	console.log('Atlas agent model tiers');
	for (const [tier, models] of Object.entries(MODEL_TIERS)) {
		console.log(`\n${tier}:`);
		for (const model of models) console.log(`  ${model}`);
	}
	console.log('\ndefaultByJob:');
	for (const [job, model] of Object.entries(DEFAULT_MODEL_BY_JOB)) {
		console.log(`  ${job}: ${model}`);
	}
}

async function checkModelAccess(input) {
	if (input.allowedModels.length && !input.allowedModels.includes(input.model)) {
		fail(
			`Model "${input.model}" is not in the allowed model list. Allowed models: ${input.allowedModels.join(', ')}`
		);
	}
	const metadata = await getModelMetadata(input.apiKey, input.modelsUrl, input.model);
	if (!metadata) {
		if (input.allowUnknownModel) {
			return {
				status: 'unknown_model',
				model: input.model,
				message:
					'Model was not found in NanoGPT model metadata. Proceeding because --allow-unknown-model is set.'
			};
		}
		fail(
			`Model "${input.model}" was not found in NanoGPT model metadata. Use --list-models to find the exact id, or pass --allow-unknown-model if you intentionally want to skip this guard.`
		);
	}
	const blockedMatch = findBlockedModelPattern(metadata, input.blockedPatterns);
	if (blockedMatch) {
		fail(
			`Model "${input.model}" is blocked by pattern "${blockedMatch}". Refusing before request.`
		);
	}
	const cost = classifyModelCost(metadata);
	if (input.freeOnly && cost.status === 'paid') {
		fail(
			`Model "${input.model}" appears to be paid (${cost.reason}). Refusing because --free-only defaults to true.`
		);
	}
	if (input.freeOnly && cost.status === 'unknown') {
		console.warn(
			`Model "${input.model}" pricing was not obvious in metadata. Proceeding, but check NanoGPT if this looks suspicious.`
		);
	}
	return {
		status: cost.status,
		reason: cost.reason,
		model: input.model,
		displayName: metadata.name ?? metadata.label ?? metadata.id ?? input.model,
		contextLength:
			metadata.context_length ??
			metadata.contextLength ??
			metadata.max_context_tokens ??
			metadata.maxContextTokens ??
			null
	};
}

function findBlockedModelPattern(metadata, patterns) {
	const haystack = JSON.stringify(metadata).toLowerCase();
	for (const pattern of patterns) {
		try {
			const regex = new RegExp(pattern, 'i');
			if (regex.test(haystack)) return pattern;
		} catch {
			if (haystack.includes(pattern.toLowerCase())) return pattern;
		}
	}
	return null;
}

async function getModelMetadata(apiKey, endpoint, modelId) {
	let models = [];
	try {
		const response = await fetch(endpoint, {
			headers: { authorization: `Bearer ${apiKey}` }
		});
		const text = await response.text();
		if (!response.ok)
			fail(`Model metadata failed: ${response.status} ${response.statusText}\n${text}`);
		const body = JSON.parse(text);
		models = Array.isArray(body) ? body : (body.data ?? body.models ?? []);
	} catch (error) {
		fail(
			`Could not read NanoGPT model metadata before request: ${error instanceof Error ? error.message : String(error)}`
		);
	}
	return models.find((model) => {
		const ids = [model.id, model.model, model.name, model.slug].filter(Boolean).map(String);
		return ids.includes(modelId);
	});
}

function classifyModelCost(model) {
	const serialized = JSON.stringify(model).toLowerCase();
	if (
		serialized.includes('"free":true') ||
		serialized.includes('"is_free":true') ||
		serialized.includes('"isfree":true')
	) {
		return { status: 'free', reason: 'model metadata marks it free' };
	}
	if (
		serialized.includes('"free":false') ||
		serialized.includes('"is_free":false') ||
		serialized.includes('"isfree":false')
	) {
		return { status: 'paid', reason: 'model metadata marks it not free' };
	}
	if (
		/\bfree\b/.test(
			String(model.tier ?? model.plan ?? model.access ?? model.pricing_tier ?? '').toLowerCase()
		)
	) {
		return { status: 'free', reason: 'model tier appears free' };
	}
	if (
		/\bpaid\b|\bpremium\b/.test(
			String(model.tier ?? model.plan ?? model.access ?? model.pricing_tier ?? '').toLowerCase()
		)
	) {
		return { status: 'paid', reason: 'model tier appears paid' };
	}
	const priceEntries = collectPriceEntries(model).filter((entry) => entry.path !== 'cost_estimate');
	if (priceEntries.length) {
		const nonzero = priceEntries.find((entry) => entry.value > 0);
		if (nonzero) return { status: 'paid', reason: `${nonzero.path}=${nonzero.value}` };
		return { status: 'free', reason: 'all discovered price fields are zero' };
	}
	if (typeof model.cost_estimate === 'number') {
		return { status: 'metered', reason: `cost_estimate=${model.cost_estimate}` };
	}
	return { status: 'unknown', reason: 'no recognizable price fields' };
}

function modelHasCapability(model, capability) {
	const capabilities = model.capabilities;
	if (capabilities && typeof capabilities === 'object') {
		return capabilities[capability] === true;
	}
	const modalities = model.modalities ?? model.input_modalities ?? model.inputModalities;
	if (Array.isArray(modalities)) {
		return modalities.map((item) => String(item).toLowerCase()).includes(capability.toLowerCase());
	}
	return false;
}

function collectPriceEntries(value, path = '', entries = []) {
	if (!value || typeof value !== 'object') return entries;
	for (const [key, child] of Object.entries(value)) {
		const childPath = path ? `${path}.${key}` : key;
		const lowerKey = key.toLowerCase();
		if (
			typeof child === 'number' &&
			/(price|cost|credit|usd|billing|dollar|cent)/.test(lowerKey) &&
			!/(context|length|max|limit|tokens?$)/.test(lowerKey)
		) {
			entries.push({ path: childPath, value: child });
		}
		if (child && typeof child === 'object') collectPriceEntries(child, childPath, entries);
	}
	return entries;
}

function printTokenPreflight(input) {
	console.log(`Token preflight: model=${input.model} job=${input.job}`);
	console.log(
		`Prompt: ${input.promptChars.toLocaleString()} chars, ~${input.estimatedPromptTokens.toLocaleString()} input tokens; requested max output ${input.maxTokens.toLocaleString()} tokens.`
	);
	if (input.modelCheck?.status) {
		console.log(
			`Model check: ${input.modelCheck.status}${input.modelCheck.reason ? ` (${input.modelCheck.reason})` : ''}`
		);
	}
}

function buildUsageRecord(input) {
	const reported = normalizeUsage(input.response?.usage);
	const estimated = {
		promptTokens: input.estimatedPromptTokens,
		completionTokens: input.estimatedCompletionTokens,
		totalTokens: input.estimatedPromptTokens + input.estimatedCompletionTokens
	};
	return {
		schema: 'pastiche.atlas.agent-usage.v1',
		timestamp: new Date().toISOString(),
		runId: input.runId,
		model: input.model,
		job: input.job,
		packetSource: input.packetSource,
		outDir: input.outDir,
		promptChars: input.promptChars,
		responseChars: input.responseChars,
		requestedMaxTokens: input.maxTokens,
		status: input.status ?? 'succeeded',
		error: input.error ?? null,
		reported,
		estimated,
		tokenCountForBudget: reported.totalTokens ?? estimated.totalTokens,
		modelCheck: input.modelCheck,
		budget: {
			weeklyTokenBudget: numberArg(
				input.args['budget-tokens'],
				envNumber('ATLAS_WEEKLY_TOKEN_BUDGET', DEFAULT_WEEKLY_TOKEN_BUDGET)
			),
			warnAtTokens: numberArg(
				input.args['warn-at-tokens'],
				envNumber('ATLAS_WARN_AT_TOKENS', DEFAULT_WARN_AT_TOKENS)
			),
			weekStartsAt: startOfLocalWeek(new Date()).toISOString()
		}
	};
}

function normalizeUsage(usage) {
	if (!usage || typeof usage !== 'object') return {};
	const promptTokens = firstNumber(
		usage.prompt_tokens,
		usage.promptTokens,
		usage.input_tokens,
		usage.inputTokens
	);
	const completionTokens = firstNumber(
		usage.completion_tokens,
		usage.completionTokens,
		usage.output_tokens,
		usage.outputTokens
	);
	const totalTokens = firstNumber(usage.total_tokens, usage.totalTokens, usage.total);
	return {
		promptTokens,
		completionTokens,
		totalTokens: totalTokens ?? addNullable(promptTokens, completionTokens),
		raw: usage
	};
}

function firstNumber(...values) {
	for (const value of values) {
		if (typeof value === 'number' && Number.isFinite(value)) return value;
	}
	return null;
}

function addNullable(left, right) {
	if (typeof left !== 'number' || typeof right !== 'number') return null;
	return left + right;
}

function estimateTokens(text) {
	if (!text) return 0;
	return Math.ceil(text.length / 4);
}

async function appendUsageRecord(args, record) {
	const ledgerPath = resolve(stringArg(args['usage-ledger'], DEFAULT_LEDGER_PATH));
	await mkdir(dirname(ledgerPath), { recursive: true });
	await appendFile(ledgerPath, `${JSON.stringify(record)}\n`, 'utf8');
}

async function printUsageSummary(args) {
	const ledgerPath = resolve(stringArg(args['usage-ledger'], DEFAULT_LEDGER_PATH));
	const budget = numberArg(
		args['budget-tokens'],
		envNumber('ATLAS_WEEKLY_TOKEN_BUDGET', DEFAULT_WEEKLY_TOKEN_BUDGET)
	);
	const warnAt = numberArg(
		args['warn-at-tokens'],
		envNumber('ATLAS_WARN_AT_TOKENS', DEFAULT_WARN_AT_TOKENS)
	);
	const sinceDays = numberArg(args['since-days'], 7);
	const now = new Date();
	const weekStart = startOfLocalWeek(now);
	const since = new Date(now.getTime() - sinceDays * 24 * 60 * 60 * 1000);
	const records = await readUsageLedger(ledgerPath);
	const weekly = records.filter((record) => new Date(record.timestamp) >= weekStart);
	const recent = records.filter((record) => new Date(record.timestamp) >= since);
	const weeklyTotal = sumTokens(weekly);
	const recentTotal = sumTokens(recent);
	console.log(`Atlas agent usage summary`);
	console.log(`Ledger: ${ledgerPath}`);
	console.log(`This week: ${weeklyTotal.toLocaleString()} / ${budget.toLocaleString()} tokens`);
	console.log(`Warning threshold: ${warnAt.toLocaleString()} tokens`);
	console.log(
		`Last ${sinceDays} days: ${recentTotal.toLocaleString()} tokens across ${recent.length} runs`
	);
	if (weeklyTotal >= warnAt) {
		console.log(`Status: warning threshold reached`);
	} else {
		console.log(
			`Status: ${(budget - weeklyTotal).toLocaleString()} weekly project tokens remaining`
		);
	}
	for (const record of topTokenRuns(weekly, 5)) {
		console.log(
			`- ${record.tokenCountForBudget.toLocaleString()} tokens | ${record.model} | ${record.job} | ${record.timestamp}`
		);
	}
}

async function readUsageLedger(ledgerPath) {
	let text = '';
	try {
		text = await readFile(ledgerPath, 'utf8');
	} catch {
		return [];
	}
	return text
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => {
			try {
				return JSON.parse(line);
			} catch {
				return null;
			}
		})
		.filter(Boolean);
}

function printBudgetWarning(args, currentRecord) {
	const budget = currentRecord.budget.weeklyTokenBudget;
	const warnAt = currentRecord.budget.warnAtTokens;
	readUsageLedger(resolve(stringArg(args['usage-ledger'], DEFAULT_LEDGER_PATH)))
		.then((records) => {
			const weekStart = startOfLocalWeek(new Date());
			const weeklyTotal = sumTokens(
				records.filter((record) => new Date(record.timestamp) >= weekStart)
			);
			if (weeklyTotal >= budget) {
				console.warn(
					`Token budget exceeded: ${weeklyTotal.toLocaleString()} / ${budget.toLocaleString()} tokens this week.`
				);
			} else if (weeklyTotal >= warnAt) {
				console.warn(
					`Token warning: ${weeklyTotal.toLocaleString()} / ${budget.toLocaleString()} project tokens used this week.`
				);
			}
		})
		.catch(() => {});
}

function sumTokens(records) {
	return records.reduce((total, record) => total + (Number(record.tokenCountForBudget) || 0), 0);
}

function topTokenRuns(records, limit) {
	return [...records]
		.sort(
			(left, right) =>
				(Number(right.tokenCountForBudget) || 0) - (Number(left.tokenCountForBudget) || 0)
		)
		.slice(0, limit);
}

function formatUsageLine(record) {
	const reported = record.reported?.totalTokens;
	const estimated = record.estimated?.totalTokens;
	if (reported) return `${reported.toLocaleString()} reported total`;
	return `~${estimated.toLocaleString()} estimated total`;
}

function startOfLocalWeek(date) {
	const copy = new Date(date);
	const day = copy.getDay();
	const diff = day === 0 ? 6 : day - 1;
	copy.setHours(0, 0, 0, 0);
	copy.setDate(copy.getDate() - diff);
	return copy;
}

function envNumber(name, fallback) {
	const value = Number(process.env[name]);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function extractJson(text) {
	const trimmed = text.trim();
	try {
		return JSON.parse(trimmed);
	} catch {
		// Some models still wrap JSON in code fences or prose despite response_format.
	}
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced) {
		try {
			return JSON.parse(fenced[1]);
		} catch {
			// Continue to balanced object extraction.
		}
	}
	const objectText = balancedJsonObject(trimmed);
	if (!objectText) return null;
	try {
		return JSON.parse(objectText);
	} catch {
		return null;
	}
}

function balancedJsonObject(text) {
	const start = text.indexOf('{');
	if (start < 0) return null;
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let index = start; index < text.length; index += 1) {
		const char = text[index];
		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			}
			continue;
		}
		if (char === '"') inString = true;
		if (char === '{') depth += 1;
		if (char === '}') depth -= 1;
		if (depth === 0) return text.slice(start, index + 1);
	}
	return null;
}

function clampContext(text, maxChars) {
	if (text.length <= maxChars) return text;
	const head = Math.floor(maxChars * 0.72);
	const tail = maxChars - head;
	return [
		text.slice(0, head),
		`\n\n[Context truncated by atlas-agent harness. Original chars: ${text.length}. Max chars: ${maxChars}.]\n\n`,
		text.slice(-tail)
	].join('');
}

function parseArgs(argv) {
	const args = {};
	for (let index = 0; index < argv.length; index += 1) {
		const item = argv[index];
		if (!item.startsWith('--')) continue;
		const key = item.slice(2);
		const next = argv[index + 1];
		if (!next || next.startsWith('--')) {
			args[key] = true;
		} else {
			args[key] = next;
			index += 1;
		}
	}
	return args;
}

function stringArg(value, fallback) {
	return typeof value === 'string' && value.length ? value : fallback;
}

function optionalString(value) {
	return typeof value === 'string' && value.length ? value : null;
}

function listArg(...values) {
	return values
		.filter((value) => typeof value === 'string' && value.trim().length)
		.flatMap((value) => value.split(','))
		.map((value) => value.trim())
		.filter(Boolean);
}

function numberArg(value, fallback) {
	if (typeof value !== 'string') return fallback;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanArg(value, fallback) {
	if (value === undefined) return fallback;
	if (value === true) return true;
	if (typeof value !== 'string') return fallback;
	return !['0', 'false', 'no'].includes(value.toLowerCase());
}

async function loadLocalEnv() {
	for (const path of ['.env.local', '.env']) {
		let text = '';
		try {
			text = await readFile(path, 'utf8');
		} catch {
			continue;
		}
		for (const rawLine of text.split(/\r?\n/)) {
			const line = rawLine.trim();
			if (!line || line.startsWith('#')) continue;
			const equals = line.indexOf('=');
			if (equals <= 0) continue;
			const key = line.slice(0, equals).trim();
			let value = line.slice(equals + 1).trim();
			if (!key || key in process.env) continue;
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			process.env[key] = value;
		}
	}
}

function fail(message) {
	console.error(message);
	process.exit(1);
}

function formatError(error) {
	if (!(error instanceof Error)) return String(error);
	return [error.stack || error.message, error.cause ? `Cause: ${formatError(error.cause)}` : '']
		.filter(Boolean)
		.join('\n');
}

function printHelp() {
	console.log(`Atlas NanoGPT agent harness

Usage:
  npm run atlas:agent -- --job asset-tagging --model <model> --asset <asset-id>
  npm run atlas:agent -- --job wiki-draft --model <model> --packet packet.md
  npm run atlas:agent -- --job vocabulary-audit --model <model> --vocabulary
  npm run atlas:agent -- --job vision-sweep --model auto --packet packet.md --image-file image.png
  npm run atlas:agent -- --list-models --q vision

Required:
  NANOGPT_API_KEY must be set in the environment or .env.local.

Options:
  --job                 asset-tagging, wiki-draft, vocabulary-audit, json-repair, vision-sweep
  --model               NanoGPT model id
  --model auto          choose the default model for the selected job
  --model-tier          routineText, deeperText, visionSweep, or visionFallback
  --list-model-tiers    print built-in Atlas model tiers and exit
  --packet              local packet file to use as context
  --asset               fetch an Atlas asset context packet from the local app
  --vocabulary          fetch the full Atlas vocabulary packet from the local app
  --image-file          local image file to send with a vision-capable model
  --image-url           remote image URL to send with a vision-capable model
  --image-from-asset    for vision-sweep + --asset, attach asset image automatically, default true
  --base-url            local app URL, default ${DEFAULT_BASE_URL}
  --format              markdown or json, default markdown
  --out                 output directory, default .pastiche/exports/agent-runs/<run-id>
  --max-context-chars   context character budget, default 60000
  --max-tokens          model output token cap, default 4096
  --temperature         default 0.1
  --reasoning-effort    optional provider/model reasoning effort
  --reasoning-exclude   hide reasoning tokens when provider supports it, default true
  --free-only           refuse models marked paid, default true
  --allowed-models      comma-separated exact model id allowlist
  --blocked-model-patterns comma-separated regex/string blocklist, x2 blocked by default
  --allow-unknown-model allow a run when the model id is absent from metadata, default false
  --usage-summary       print local token usage summary and exit
  --usage-ledger        token ledger path, default ${DEFAULT_LEDGER_PATH}
  --budget-tokens       weekly project budget, default ${DEFAULT_WEEKLY_TOKEN_BUDGET}
  --warn-at-tokens      weekly warning threshold, default ${DEFAULT_WARN_AT_TOKENS}
`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.stack || error.message : error);
	process.exit(1);
});
