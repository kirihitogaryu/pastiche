import type { MediumCategory } from './types';

const mediumRules: Array<{ category: MediumCategory; terms: string[] }> = [
	{ category: 'oil', terms: ['oil'] },
	{ category: 'watercolor', terms: ['watercolor', 'watercolour'] },
	{ category: 'tempera', terms: ['tempera'] },
	{ category: 'fresco', terms: ['fresco'] },
	{
		category: 'print',
		terms: ['engraving', 'etching', 'lithograph', 'woodcut', 'print', 'aquatint']
	},
	{
		category: 'drawing',
		terms: ['pencil', 'chalk', 'charcoal', 'ink', 'drawing', 'pastel']
	},
	{
		category: 'photograph',
		terms: ['photograph', 'gelatin', 'albumen', 'daguerreotype']
	},
	{
		category: 'sculpture',
		terms: ['marble', 'bronze', 'terracotta', 'wood', 'ivory', 'cast', 'carved', 'sculpt']
	},
	{
		category: 'textile',
		terms: ['silk', 'wool', 'linen', 'cotton', 'embroid', 'tapestry', 'textile', 'woven']
	},
	{
		category: 'ceramic',
		terms: ['ceramic', 'porcelain', 'earthenware', 'stoneware', 'faience']
	},
	{
		category: 'metalwork',
		terms: ['gold', 'silver', 'copper', 'iron', 'steel', 'brass', 'metal']
	},
	{ category: 'glass', terms: ['glass'] }
];

export function normalizeMedium(raw: string | null): MediumCategory | null {
	if (raw === null) return null;

	const lower = raw.toLowerCase();
	for (const rule of mediumRules) {
		if (rule.terms.some((term) => lower.includes(term))) return rule.category;
	}

	return 'other';
}
