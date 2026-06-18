import { getUser, updateDiscordId } from '@zeepkist/database/services'
import { Elysia, t } from 'elysia'
import { withAuthGtr, withAuthRequest } from '../../plugins/withAuth'
import { withRateLimit } from '../../plugins/withRateLimit'

export const userRoutes = new Elysia({ prefix: '/user' })
	.group('/updateSteamName', (app) =>
		app
			.use(withAuthGtr)
			.use(withRateLimit('mutation'))
			.post(
				'',
				async ({ auth, set }) => {
					const user = await getUser(auth.steamId)
					if (!user || user.banned) {
						set.status = 401
						return
					}
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
		app
			.use(withAuthRequest)
			.use(withRateLimit('mutation'))
			.post(
				'',
				async ({ auth, body, set }) => {
					const { Id } = body
					const user = await getUser(auth.steamId)
					if (!user || user.banned) {
						set.status = 401
						return
					}

					if (!Id) {
						set.status = 200
						return
					}

					await updateDiscordId(auth.steamId, Id === '-1' ? -1n : BigInt(Id))

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
