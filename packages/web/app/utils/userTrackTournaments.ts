import type { Zc_UserTrackTournamentResultsQuery } from '@zeepkist/graphql/generated'
import type { CursorPage } from '~/types/app'
import type { UserTrackTournamentResult } from '~/types/tournament'
import { getLevelDisplayName } from './levelDisplay'

export function mapUserTrackTournamentResults(
	connection: Zc_UserTrackTournamentResultsQuery['trackTournaments'] | undefined,
	userId: number,
): UserTrackTournamentResult[] {
	return (connection?.edges ?? []).flatMap(({ node }) => {
		const result = node.trackTournamentResults.nodes.find((row) => row.userId === userId)
		if (!result || (node.type !== 0 && node.type !== 1)) return []
		const item = node.level?.levelItems.nodes[0]
		return [
			{
				id: node.id,
				type: node.type,
				slug: node.slug,
				startAt: String(node.startAt),
				endAt: String(node.endAt),
				finalizedAt: node.finalizedAt == null ? null : String(node.finalizedAt),
				levelName: node.level ? getLevelDisplayName(item?.name, node.level.xxHash) : null,
				imageUrl: item?.imageUrl ?? null,
				authorName: item?.author?.steamName ?? null,
				rank: result.rank,
				points: result.points,
				time: result.time,
			},
		]
	})
}

export function mapUserTrackTournamentPage(
	connection?: Zc_UserTrackTournamentResultsQuery['trackTournaments'],
): CursorPage {
	const info = connection?.pageInfo
	return info
		? {
				startCursor: String(info.startCursor ?? '') || null,
				endCursor: String(info.endCursor ?? '') || null,
				hasNextPage: info.hasNextPage,
				hasPreviousPage: info.hasPreviousPage,
			}
		: { hasNextPage: false, hasPreviousPage: false }
}
