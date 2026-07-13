import { getRefreshableWebSession, getWebSession } from '@zeepkist/database/services'
import type { SessionUser } from '../../app/types/app'
import { cookieHeaderFromSetCookies, refreshWebAuth } from '../utils/backend'
import { assertSameOrigin } from '../utils/request'
import { resolveVerifiedSession } from '../utils/session'

function responseFromSession(session: NonNullable<Awaited<ReturnType<typeof getWebSession>>>) {
	const user: SessionUser = {
		id: session.id,
		steamId: String(session.steamId),
		steamName: session.steamName ?? undefined,
		discordId: session.discordId == null ? null : String(session.discordId),
	}
	return {
		user,
		refreshAt: Number(session.accessTokenExpiry) * 1000 - 60_000,
	}
}

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	const cookieHeader = getHeader(event, 'cookie')
	const resolution = await resolveVerifiedSession(
		cookieHeader,
		getWebSession,
		getRefreshableWebSession,
		async () => {
			const refreshed = await refreshWebAuth(event)
			return cookieHeaderFromSetCookies(refreshed.cookies)
		},
	)
	if (import.meta.dev) {
		setResponseHeader(event, 'x-zeep-auth-resolution', resolution.reason)
	}
	return resolution.session
		? responseFromSession(resolution.session)
		: { user: null, refreshAt: null }
})
