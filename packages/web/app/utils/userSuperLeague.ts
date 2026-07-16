import type { UserSuperLeagueRoundResult, UserSuperLeagueSummary } from '~/types/app'

type SeasonNode = {
	id: number
	name: string
	startDate: unknown
	endDate: unknown
	pointsStructure?: { bestOf: number } | null
	zslSeasonResults: { nodes: Array<{ position: number; points: number }> }
	zslRounds: {
		nodes: Array<{
			id: number
			round: number
			name: string
			eventDate: unknown
			zslRoundResults: { nodes: Array<{ position: number; points: number }> }
		}>
	}
}

export function applySuperLeagueBestOf(
	rounds: Omit<UserSuperLeagueRoundResult, 'counted'>[],
	bestOf: number,
): UserSuperLeagueRoundResult[] {
	const count = Math.max(0, Math.min(Math.floor(bestOf), rounds.length))
	const countedIds = new Set(
		[...rounds]
			.sort((left, right) => right.points - left.points || left.round - right.round)
			.slice(0, count)
			.map((round) => round.id),
	)
	return rounds.map((round) => ({ ...round, counted: countedIds.has(round.id) }))
}

export function buildUserSuperLeagueSummary(
	season?: SeasonNode | null,
): UserSuperLeagueSummary | null {
	if (!season) return null
	const standing = season.zslSeasonResults.nodes[0]
	const rounds = season.zslRounds.nodes.flatMap((round) => {
		const result = round.zslRoundResults.nodes[0]
		return result
			? [
					{
						id: round.id,
						round: round.round,
						name: round.name,
						eventDate: String(round.eventDate),
						position: result.position,
						points: result.points,
					},
				]
			: []
	})
	const bestOf = season.pointsStructure?.bestOf ?? rounds.length

	return {
		id: season.id,
		name: season.name,
		startDate: String(season.startDate),
		endDate: String(season.endDate),
		bestOf,
		position: standing?.position ?? null,
		points: standing?.points ?? null,
		rounds: applySuperLeagueBestOf(rounds, bestOf),
	}
}
