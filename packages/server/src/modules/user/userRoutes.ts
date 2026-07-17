import { getUser, updateDiscordId } from '@zeepkist/database/services'
import { Elysia, t } from 'elysia'
import { GTR_BEARER_SECURITY, OPENAPI_TAG, USER_SECURITY } from '../../openapi'
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
						Name: t.String({ description: 'Current Steam display name.' }),
					}),
					detail: {
						operationId: 'updateSteamName',
						summary: 'Submit a Steam display-name update',
						description:
							'Accepts an authenticated GTR Steam display-name update request.',
						security: GTR_BEARER_SECURITY,
						tags: [OPENAPI_TAG.user],
					},
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
						Id: t.String({
							description:
								'Discord user ID to link, or `-1` to remove the current link.',
						}),
					}),
					detail: {
						operationId: 'updateDiscordId',
						summary: 'Link or unlink a Discord account',
						description:
							'Updates the Discord account linked to the authenticated ZeepCentraal user.',
						security: USER_SECURITY,
						tags: [OPENAPI_TAG.user],
					},
				},
			),
	)
