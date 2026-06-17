import { type AccessTokenPayload, verifyAccessToken } from '@zeepkist/core'
import { updateDiscordId } from '@zeepkist/database/services'
import { Elysia, t } from 'elysia'
import { withAuthGtr, withAuthRequest } from '../../plugins/withAuth'

function getCookieToken(cookieHeader?: string): string | null {
	if (!cookieHeader) {
		return null
	}

	for (const item of cookieHeader.split(';')) {
		const [key, ...rest] = item.trim().split('=')
		if (key === 'zeepcentral_access_token') {
			return decodeURIComponent(rest.join('='))
		}
	}

	return null
}

function getBearerToken(authorization?: string): string | null {
	if (!authorization?.startsWith('Bearer ')) {
		return null
	}

	return authorization.slice(7)
}

export const userRoutes = new Elysia({ prefix: '/user' })
	.group('/updateSteamName', (app) =>
		app.use(withAuthGtr).post(
			'',
			({ set }) => {
				set.status = 200
				return
			},
			{
				body: t.Object({
					Name: t.String(),
				}),
			},
		),
	)
	.group('/updateDiscordId', (app) =>
		app.use(withAuthRequest).post(
			'',
			async ({ body, headers, set }) => {
				const { Id } = body
				const token =
					getBearerToken(headers.authorization) ?? getCookieToken(headers.cookie)

				if (!token) {
					set.status = 400
					return
				}

				let auth: AccessTokenPayload
				try {
					auth = verifyAccessToken(token)
				} catch {
					set.status = 401
					return
				}

				if (!Id) {
					set.status = 200
					return
				}

				await updateDiscordId(auth.steamId, Id === '-1' ? null : BigInt(Id))

				set.status = 200
				return
			},
			{
				body: t.Object({
					Id: t.String(),
				}),
			},
		),
	)
