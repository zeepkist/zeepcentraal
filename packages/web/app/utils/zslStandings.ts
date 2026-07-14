import type { ZslStanding } from '../types/app'

type RoundPointResult = {
	points: number
	round?: { round: number } | null
}

export type ZslStandingNode = {
	position: number
	points: number
	userId: number
	user?: {
		steamId: unknown
		steamName?: string | null
		zslLevelResults?: { totalCount: number } | null
		zslRoundResults?: { nodes: ReadonlyArray<RoundPointResult> } | null
	} | null
	time?: number
}

export function mapSeasonRoundPoints(
	results: readonly RoundPointResult[],
	bestOf: number,
	roundCount = 6,
): Array<number | null> {
	const validResults = results.filter(
		(result): result is RoundPointResult & { round: { round: number } } =>
			result.round != null && result.round.round >= 1 && result.round.round <= roundCount,
	)
	const countedRounds = new Set(
		[...validResults]
			.sort(
				(left, right) => right.points - left.points || left.round.round - right.round.round,
			)
			.slice(0, Math.max(0, Math.min(Math.floor(bestOf), validResults.length)))
			.map((result) => result.round.round),
	)
	const pointsByRound = new Map(
		validResults.map((result) => [result.round.round, result.points] as const),
	)

	return Array.from({ length: roundCount }, (_, index) => {
		const round = index + 1
		return countedRounds.has(round) ? (pointsByRound.get(round) ?? null) : null
	})
}

export function mapZslStanding(node: ZslStandingNode, bestOf?: number): ZslStanding {
	const row: ZslStanding = {
		userId: node.userId,
		position: node.position,
		points: node.points,
		steamId: node.user ? String(node.user.steamId) : null,
		steamName: node.user?.steamName ?? null,
		time: node.time,
	}
	if (node.user?.zslLevelResults) {
		row.levelsPlayed = node.user.zslLevelResults.totalCount
	}
	if (bestOf !== undefined) {
		row.roundPoints = mapSeasonRoundPoints(node.user?.zslRoundResults?.nodes ?? [], bestOf)
	}
	return row
}

export function mergeViewerStanding(
	rows: ZslStanding[],
	viewerNode?: ZslStandingNode | null,
	bestOf?: number,
): ZslStanding[] {
	if (!viewerNode || rows.some((row) => row.userId === viewerNode.userId)) return rows
	return [...rows, { ...mapZslStanding(viewerNode, bestOf), pinned: true }]
}
