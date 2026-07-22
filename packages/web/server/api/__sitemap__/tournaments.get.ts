import type { Zc_SitemapTrackTournamentsQuery } from '../../../app/graphql/generated/graphql'
import {
	Zc_SitemapTournamentsDocument,
	Zc_SitemapTrackTournamentsDocument,
} from '../../../app/graphql/generated/graphql'
import {
	superLeagueLevelPath,
	superLeagueRoundPath,
	superLeagueSeasonPath,
} from '../../../app/utils/superLeagueRoutes'
import { tournamentPath } from '../../../app/utils/tournament'
import { fetchGraphql } from '../../utils/graphql'
export default defineSitemapEventHandler(async () => {
	const urls = []
	let after: string | undefined
	do {
		const data = await fetchGraphql(Zc_SitemapTournamentsDocument, { after })
		const connection = data.zslSeasons
		if (!connection) break
		for (const season of connection.nodes) {
			urls.push({
				loc: superLeagueSeasonPath(season.id),
				lastmod: String(season.dateUpdated ?? season.dateCreated),
			})
			for (const round of season.zslRounds.nodes) {
				urls.push({
					loc: superLeagueRoundPath(season.id, round.round),
					lastmod: String(round.dateUpdated ?? round.dateCreated),
				})
				urls.push(
					...round.zslLevels.nodes.map((level) => ({
						loc: superLeagueLevelPath(season.id, round.round, level.id),
						lastmod: String(level.dateUpdated ?? level.dateCreated),
					})),
				)
			}
		}
		after = connection.pageInfo.hasNextPage ? String(connection.pageInfo.endCursor) : undefined
	} while (after)

	after = undefined
	const now = new Date().toISOString()
	do {
		const data: Zc_SitemapTrackTournamentsQuery = await fetchGraphql(
			Zc_SitemapTrackTournamentsDocument,
			{ after, now },
		)
		const connection = data.trackTournaments
		if (!connection) break
		urls.push(
			...connection.nodes
				.filter((tournament) => tournament.type === 0 || tournament.type === 1)
				.map((tournament) => ({
					loc: tournamentPath(tournament.type as 0 | 1, tournament.slug),
					lastmod: String(tournament.dateUpdated ?? tournament.dateCreated),
				})),
		)
		after = connection.pageInfo.hasNextPage ? String(connection.pageInfo.endCursor) : undefined
	} while (after)
	return urls
})
