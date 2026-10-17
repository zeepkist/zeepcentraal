import { getRefreshableWebSession, getWebSession } from '@zeepkist/database/services'
import { defineEventHandler, getRequestHeader } from 'nuxt/server'
import { hasRefreshableWebAuthCookieTuple } from '#shared/authCookies'
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
		isAdmin: session.role === 'admin',
		refreshAt: Number(session.accessTokenExpiry) * 1000 - 60_000,
	}
}

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	event.res.headers.set('cache-control', 'private, no-store')
	const cookieHeader = getRequestHeader(event, 'cookie')
	const startedAt = performance.now()
	const resolution = await resolveVerifiedSession(
		cookieHeader,
		getWebSession,
		getRefreshableWebSession,
		async () => {
			const refreshed = await refreshWebAuth(event)
			return cookieHeaderFromSetCookies(refreshed.cookies)
		},
	)
	if (hasRefreshableWebAuthCookieTuple(cookieHeader)) {
		event.res.headers.append(
			'server-timing',
			`auth_session;dur=${(performance.now() - startedAt).toFixed(1)}`,
		)
	}
	if (import.meta.dev) {
		event.res.headers.set('x-zeep-auth-resolution', resolution.reason)
	}
	return resolution.session
		? responseFromSession(resolution.session)
		: { user: null, isAdmin: false, refreshAt: null }
})
