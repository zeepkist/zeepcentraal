import { calculatePlayerPointsFromContributions } from '@zeepkist/core/score'
import {
	getUserPointContributionsForUsers,
	persistUserPointScore,
	type UserPointContributionInput,
} from '@zeepkist/database'

export const PLAYER_SCORE_SNAPSHOT_ATTEMPTS = 3

type SourceContribution = Omit<UserPointContributionInput, 'idUser'>

export async function recalculateAndPersistPlayerScore({
	idUser,
	initialContributions,
	onSnapshotMismatch,
}: {
	idUser: number
	initialContributions?: SourceContribution[]
	onSnapshotMismatch?: (attempt: number) => void
}) {
	let contributions = initialContributions
	for (let attempt = 1; attempt <= PLAYER_SCORE_SNAPSHOT_ATTEMPTS; attempt++) {
		if (!contributions) {
			const contributionsByUser = await getUserPointContributionsForUsers([idUser])
			contributions = contributionsByUser.get(idUser) ?? []
		}

		const result = calculatePlayerPointsFromContributions(contributions)
		const persisted = await persistUserPointScore({ idUser, ...result })
		if (persisted) {
			return result
		}

		onSnapshotMismatch?.(attempt)
		contributions = undefined
	}

	throw new Error(
		`Player contribution snapshot changed ${PLAYER_SCORE_SNAPSHOT_ATTEMPTS} times for idUser=${idUser}.`,
	)
}
