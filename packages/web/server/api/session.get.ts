import { Zc_SessionUserDocument } from '../../app/graphql/generated/graphql'
import type { SessionUser } from '../../app/types/app'
import { accessTokenRefreshAt, refreshWebAuth } from '../utils/backend'
import { fetchGraphql } from '../utils/graphql'
import { assertSameOrigin } from '../utils/request'

async function fetchSessionUser(
	event: Parameters<typeof getCookie>[0],
): Promise<SessionUser | null> {
	const steamId = getCookie(event, 'zeepcentral_steam_id')
	if (!steamId) return null

	const data = await fetchGraphql(Zc_SessionUserDocument, { steamId })
	const user = data.users?.nodes[0]
	if (!user) return null

	return {
		id: user.id,
		steamId: String(user.steamId),
		steamName: user.steamName ?? undefined,
		discordId: user.discordId == null ? null : String(user.discordId),
	}
}

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	let refreshAt = accessTokenRefreshAt(getHeader(event, 'cookie'))
	if (refreshAt !== null && refreshAt <= Date.now()) {
		try {
			refreshAt = (await refreshWebAuth(event)).refreshAt
		} catch {
			return { user: null, refreshAt: null }
		}
	}
	try {
		return {
			user: await fetchSessionUser(event),
			refreshAt,
		}
	} catch {
		try {
			refreshAt = (await refreshWebAuth(event)).refreshAt
			return {
				user: await fetchSessionUser(event),
				refreshAt,
			}
		} catch {
			return { user: null, refreshAt: null }
		}
	}
})
