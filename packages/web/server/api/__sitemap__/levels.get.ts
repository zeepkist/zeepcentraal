import { Zc_SitemapLevelsDocument } from '../../../app/graphql/generated/graphql'
import { fetchGraphql } from '../../utils/graphql'
export default defineSitemapEventHandler(async () => {
	const urls = []
	let after: string | undefined
	do {
		const data = await fetchGraphql(Zc_SitemapLevelsDocument, { after })
		const connection = data.levels
		if (!connection) break
		urls.push(
			...connection.nodes.map((level) => ({
				loc: `/level/${level.xxHash}`,
				lastmod: String(level.dateUpdated ?? level.dateCreated),
			})),
		)
		after = connection.pageInfo.hasNextPage ? String(connection.pageInfo.endCursor) : undefined
	} while (after)
	return urls
})
