import {
	createDiscordLinkCode,
	getUser,
	unlinkDiscordBySteamId,
	updateDiscordId,
} from '@zeepkist/database/services'
import { Elysia, t } from 'elysia'
import { GTR_BEARER_SECURITY, OPENAPI_TAG, USER_SECURITY } from '../../openapi'
import { withAuthGtr, withAuthRequest } from '../../plugins/withAuth'
import { withRateLimit } from '../../plugins/withRateLimit'
import { ERROR_CODES, handleProblem } from '../../problems'
import { hashDiscordLinkCode, randomDiscordLinkCode } from '../discord/discordLink'

export const userRoutes = new Elysia({ prefix: '/user' })
	.group('/updateSteamName', (app) =>
		app
			.use(withAuthGtr)
			.use(withRateLimit('mutation'))
			.post(
				'',
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
				async ({ auth, set }) => {
					const user = await getUser(auth.steamId)
					if (!user || user.banned) {
						return handleProblem(401, ERROR_CODES.AUTH_USER_NOT_FOUND)
					}
					set.status = 200
					return
				},
			),
	)
	.group('/updateDiscordId', (app) =>
		app
			.use(withAuthRequest)
			.use(withRateLimit('mutation'))
			.post(
				'',
				{
					body: t.Object({
						Id: t.String({
							description:
								'Legacy unlink sentinel. Positive IDs require verified linking.',
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
				async ({ auth, body, set }) => {
					const { Id } = body
					const user = await getUser(auth.steamId)
					if (!user || user.banned) {
						return handleProblem(401, ERROR_CODES.AUTH_USER_NOT_FOUND)
					}

					if (!Id) {
						set.status = 200
						return
					}

					if (Id !== '-1') {
						return handleProblem(
							400,
							'Positive Discord IDs require OAuth or one-time code verification.',
							'discord_ownership_required',
						)
					}

					await updateDiscordId(auth.steamId, -1n)

					set.status = 200
					return
				},
			),
	)
	.group('/discord', (app) =>
		app
			.use(withAuthRequest)
			.use(withRateLimit('mutation'))
			.post(
				'/link-code',
				{
					detail: {
						operationId: 'createDiscordLinkCode',
						summary: 'Create a one-time Discord account link code',
						security: USER_SECURITY,
						tags: [OPENAPI_TAG.user],
					},
				},
				async ({ auth }) => {
					const linkedUser = await getUser(auth.steamId)
					if (!linkedUser || linkedUser.banned) {
						return handleProblem(401, ERROR_CODES.AUTH_USER_NOT_FOUND)
					}
					const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString()
					for (let attempt = 0; attempt < 5; attempt++) {
						const code = randomDiscordLinkCode()
						try {
							await createDiscordLinkCode({
								codeHash: hashDiscordLinkCode(code),
								idUser: linkedUser.id,
								expiresAt,
							})
							return { code, expiresAt }
						} catch (error) {
							if (attempt === 4) throw error
						}
					}
					throw new Error('Unable to generate Discord link code')
				},
			)
			.delete(
				'',
				{
					detail: {
						operationId: 'unlinkDiscordAccount',
						summary: 'Unlink verified Discord account',
						security: USER_SECURITY,
						tags: [OPENAPI_TAG.user],
					},
				},
				async ({ auth, set }) => {
					await unlinkDiscordBySteamId(auth.steamId)
					set.status = 204
				},
			),
	)
