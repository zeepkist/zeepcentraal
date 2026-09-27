import type { SuperLeagueVoteCandidate } from '~/composables/useSuperLeagueVote'
import type { LevelSummary } from '~/types/app'
import { normaliseOgImageUrl } from '~/utils/ogImage'

export function voteCandidateLevel(candidate: SuperLeagueVoteCandidate): LevelSummary {
	return {
		id: candidate.levelId,
		xxHash: candidate.xxHash,
		favourited: false,
		name: candidate.name ?? candidate.xxHash,
		imageUrl: normaliseOgImageUrl(candidate.imageUrl),
		authorName: candidate.authorName,
		workshopId: String(candidate.workshopId),
		adventure: candidate.adventure,
		dateCreated: candidate.dateCreated,
		points: candidate.points,
		rating: candidate.rating,
		recordCount: candidate.recordCount,
		personalBestCount: candidate.personalBestCount,
		voteCount: candidate.voteCount,
	}
}
