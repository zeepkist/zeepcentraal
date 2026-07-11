import { Zc_SitemapUsersDocument } from '../../../app/graphql/generated/graphql'
import { fetchGraphql } from '../../utils/graphql'
export default defineSitemapEventHandler(async () => {
	const urls = []
	let after: string | undefined
	do {
		const data = await fetchGraphql(Zc_SitemapUsersDocument, { after })
		const connection = data.users
		if (!connection) break
		urls.push(
			...connection.nodes.map((user) => ({
				loc: `/user/${String(user.steamId)}`,
				lastmod: String(user.dateUpdated ?? user.dateCreated),
			})),
		)
		after = connection.pageInfo.hasNextPage ? String(connection.pageInfo.endCursor) : undefined
	} while (after)
	return urls
})
