import { Zc_AdventurePlayerLevelsDocument } from '@zeepkist/graphql/generated'
import { createError, defineEventHandler, getQuery, getRequestHeader } from 'nuxt/server'
import {
	AdventurePlaylistError,
	collectAdventurePlaylist,
	parseAdventurePlaylistQuery,
} from '../../utils/adventurePlaylist'
import { cookieHeaderFromSetCookies, refreshWebAuth } from '../../utils/backend'
import { fetchGraphql } from '../../utils/graphql'
import { assertSameOrigin } from '../../utils/request'
import { resolveVerifiedSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
	event.res.headers.set('cache-control', 'private, no-store')
	try {
		const request = parseAdventurePlaylistQuery(getQuery(event))
		let viewerId = 0
		if (request.missing) {
			assertSameOrigin(event)
			const { getRefreshableWebSession, getWebSession } = await import(
				'@zeepkist/database/services'
			)
			const resolution = await resolveVerifiedSession(
				getRequestHeader(event, 'cookie'),
				getWebSession,
				getRefreshableWebSession,
				async () => cookieHeaderFromSetCookies((await refreshWebAuth(event)).cookies),
			)
			if (!resolution.session)
				throw createError({ status: 401, statusText: 'Authentication required' })
			viewerId = resolution.session.id
		}
		const playlist = await collectAdventurePlaylist(
			async (after) => {
				const result = await fetchGraphql(Zc_AdventurePlayerLevelsDocument, {
					after,
					playerId: viewerId,
					includePlayer: request.missing,
					filter: request.series ? { series: { equalTo: request.series } } : undefined,
				})
				if (!result.adventureLevelMemberships)
					throw createError({ status: 502, statusText: 'Adventure mappings unavailable' })
				return result.adventureLevelMemberships
			},
			request.series,
			request.missing,
		)
		event.res.headers.set('content-disposition', `attachment; filename="${playlist.filename}"`)
		event.res.headers.set('content-type', 'application/json; charset=utf-8')
		event.res.headers.set('x-content-type-options', 'nosniff')
		return playlist.body
	} catch (cause) {
		if (cause instanceof AdventurePlaylistError)
			throw createError({ status: cause.status, statusText: cause.message })
		throw cause
	}
})
