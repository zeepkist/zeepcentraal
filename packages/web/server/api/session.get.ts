import type { SessionUser } from '../../app/types/app'
import { accessTokenRefreshAt, fetchBackendUser, refreshWebAuth } from '../utils/backend'
import { assertSameOrigin } from '../utils/request'

function normalizeUser(user: {
	Id?: number
	SteamId?: string
	SteamName?: string
	DiscordId?: string | null
	id?: number
	steamId?: string
	steamName?: string
	discordId?: string | null
}): SessionUser {
	return {
		id: user.id ?? user.Id ?? 0,
		steamId: user.steamId ?? user.SteamId ?? '',
		steamName: user.steamName ?? user.SteamName,
		discordId: user.discordId ?? user.DiscordId ?? null,
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
			user: normalizeUser(
				(await fetchBackendUser(event)) as Parameters<typeof normalizeUser>[0],
			),
			refreshAt,
		}
	} catch {
		try {
			refreshAt = (await refreshWebAuth(event)).refreshAt
			return {
				user: normalizeUser(
					(await fetchBackendUser(event)) as Parameters<typeof normalizeUser>[0],
				),
				refreshAt,
			}
		} catch {
			return { user: null, refreshAt: null }
		}
	}
})
