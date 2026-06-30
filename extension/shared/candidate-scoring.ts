import {
	candidateMaxDimension,
	candidateVisibleArea,
	type CandidateConfidence,
	type ImageCandidate
} from './candidates';

export type ScoreCandidateOptions = {
	minDimension: number;
	directSelection: boolean;
};

const ICON_LIKE_PATTERN =
	/(^|[/?#&._-])(avatar|badge|button|emoji|favicon|icon|logo|pixel|sprite|tracking)([/?#&._-]|$)/i;
const WEAK_QUALITY_PATTERN =
	/(^|[/?#&._-])(crop|cropped|preview|sample|small|thumb|thumbnail)([/?#&._-]|$)/i;
const STRONG_QUALITY_PATTERN =
	/(^|[/?#&._-])(download|full|fullsize|hires|large|larger|master|orig|original|raw)([/?#&._-]|$)/i;

export function scoreCandidate(
	candidate: ImageCandidate,
	options: ScoreCandidateOptions
): ImageCandidate {
	const rejectionReasons: string[] = [];
	const scoreReasons: string[] = [];
	const maxDimension = candidateMaxDimension(candidate);
	const visibleArea = candidateVisibleArea(candidate);
	let score = 0;

	if (!options.directSelection && maxDimension > 0 && maxDimension < options.minDimension) {
		rejectionReasons.push('below minimum page-scan size');
		score -= 1000;
	}

	if (ICON_LIKE_PATTERN.test(candidate.url)) {
		rejectionReasons.push('icon-like URL');
		score -= options.directSelection ? 80 : 1000;
	}

	if (maxDimension >= 2000) {
		score += 260;
		scoreReasons.push('large pixel dimensions');
	} else if (maxDimension >= 1000) {
		score += 160;
		scoreReasons.push('good pixel dimensions');
	} else if (maxDimension >= options.minDimension) {
		score += 60;
		scoreReasons.push('passes minimum dimensions');
	} else if (maxDimension > 0) {
		score -= 30;
		scoreReasons.push('small pixel dimensions');
	}

	if (visibleArea >= 250_000) {
		score += 70;
		scoreReasons.push('large visible area');
	} else if (visibleArea >= 40_000) {
		score += 30;
		scoreReasons.push('visible on page');
	}

	if (STRONG_QUALITY_PATTERN.test(candidate.url)) {
		score += 140;
		scoreReasons.push('original/full URL hint');
	}

	if (WEAK_QUALITY_PATTERN.test(candidate.url)) {
		score -= 90;
		scoreReasons.push('thumbnail/preview URL hint');
	}

	if (candidate.kind === 'meta' || candidate.kind === 'json_ld') {
		score += 35;
		scoreReasons.push('source metadata candidate');
	}

	if (candidate.kind === 'srcset' || candidate.kind === 'picture') {
		score += 25;
		scoreReasons.push('responsive image candidate');
	}

	if (candidate.kind === 'screenshot') {
		score -= 120;
		scoreReasons.push('screenshot fallback');
	}

	return {
		...candidate,
		score,
		confidence: confidenceFor(score, maxDimension, rejectionReasons, options),
		rejectionReasons,
		scoreReasons
	};
}

export function chooseBestCandidate(candidates: ImageCandidate[]): ImageCandidate | null {
	if (candidates.length === 0) return null;
	return [...candidates].sort((a, b) => {
		if (b.rejectionReasons.length !== a.rejectionReasons.length) {
			return a.rejectionReasons.length - b.rejectionReasons.length;
		}
		return b.score - a.score;
	})[0];
}

function confidenceFor(
	score: number,
	maxDimension: number,
	rejectionReasons: string[],
	options: ScoreCandidateOptions
): CandidateConfidence {
	if (rejectionReasons.length > 0) return 'low';
	if (maxDimension > 0 && maxDimension < options.minDimension) return 'low';
	if (score >= 250) return 'high';
	if (score >= 80) return 'medium';
	return 'low';
}
