import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type AtlasWikiDocConfig = {
	title: string;
	description: string;
	filename: string;
};

const DOC_ROOT = join(process.cwd(), 'docs', 'atlas', 'wiki');

const DOCS: Record<string, AtlasWikiDocConfig> = {
	'contribution-guidelines': {
		title: 'Contribution Guidelines',
		description: 'Rules for adding, changing, and reviewing Atlas vocabulary.',
		filename: 'contribution-guidelines.md'
	},
	'tagging-rules': {
		title: 'Tagging Rules',
		description: 'The retrieval-first rules for visual tags, entities, classifiers, and claims.',
		filename: 'tagging-rules.md'
	},
	'style-guide': {
		title: 'Wiki Style Guide',
		description: 'The writing standards for concise, factual, link-rich wiki entries.',
		filename: 'style-guide.md'
	},
	'artist-entity-style-guide': {
		title: 'Artist Entity Style Guide',
		description: 'How artist pages differ from ordinary visual tags.',
		filename: 'artist-entity-style-guide.md'
	},
	'implication-rules': {
		title: 'Implication Rules',
		description: 'Conservative rules for automatic tag implications.',
		filename: 'implication-rules.md'
	},
	'ai-agent-tagging-rules': {
		title: 'AI Agent Tagging Rules',
		description: 'Required behavior for agents that suggest or create Atlas metadata.',
		filename: 'ai-agent-tagging-rules.md'
	},
	'batch-editor-guide': {
		title: 'Batch Editor Guide',
		description: 'Strict JSON instructions and examples for Atlas batch metadata edits.',
		filename: 'batch-editor-guide.md'
	},
	'wiki-entry-templates': {
		title: 'Wiki Entry Templates',
		description: 'Checklists for drafting new Atlas wiki entries.',
		filename: 'wiki-entry-templates.md'
	},
	'apollo-killing-python-seed-tag-plan': {
		title: 'Apollo Killing the Python Seed Tag Plan',
		description: 'The first dense tagging fixture used to test Atlas vocabulary.',
		filename: 'apollo-killing-python-seed-tag-plan.md'
	}
};

export type AtlasWikiDocSummary = {
	slug: string;
	title: string;
	description: string;
};

export type AtlasWikiDoc = AtlasWikiDocSummary & {
	markdown: string;
};

export function listAtlasWikiDocs(): AtlasWikiDocSummary[] {
	return Object.entries(DOCS).map(([slug, doc]) => ({
		slug,
		title: doc.title,
		description: doc.description
	}));
}

export function readAtlasWikiDoc(slug: string): AtlasWikiDoc | null {
	const doc = DOCS[slug];
	if (!doc) return null;

	return {
		slug,
		title: doc.title,
		description: doc.description,
		markdown: readFileSync(join(DOC_ROOT, doc.filename), 'utf8')
	};
}
