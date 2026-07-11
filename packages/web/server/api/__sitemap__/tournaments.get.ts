import { Zc_SitemapTournamentsDocument } from '../../../app/graphql/generated/graphql'
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
				loc: `/zsl/${season.id}`,
				lastmod: String(season.dateUpdated ?? season.dateCreated),
			})
			for (const round of season.zslRounds.nodes) {
				urls.push({
					loc: `/zsl/${season.id}/${round.id}`,
					lastmod: String(round.dateUpdated ?? round.dateCreated),
				})
				urls.push(
					...round.zslLevels.nodes.map((level) => ({
						loc: `/zsl/${season.id}/${round.id}/${level.id}`,
						lastmod: String(level.dateUpdated ?? level.dateCreated),
					})),
				)
			}
		}
		after = connection.pageInfo.hasNextPage ? String(connection.pageInfo.endCursor) : undefined
	} while (after)
	return urls
})
