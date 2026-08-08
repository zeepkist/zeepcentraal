import {
	addDiscordWatch,
	advanceDiscordGuildFeedCursor,
	advanceDiscordWorkerCursor,
	consumeDiscordLinkCode,
	DISCORD_FEED_KINDS,
	DISCORD_WATCH_KINDS,
	getDiscordDelivery,
	getDiscordGuildState,
	getDiscordUserState,
	getDiscordWorkerCursor,
	getEnabledDiscordGuildFeeds,
	getMatchingDiscordWatches,
	removeDiscordWatch,
	setDiscordDelivery,
	setDiscordDigest,
	setDiscordGuildFeed,
	setDiscordGuildLinkedRole,
	setDiscordTournamentMessage,
	setDiscordUserPreference,
	unlinkDiscordByDiscordId,
	updateDiscordWatchDelivery,
} from '@zeepkist/database/services'
import { Elysia, t } from 'elysia'
import { DISCORD_BOT_SECURITY, OPENAPI_TAG } from '../../openapi'
import { withAuthDiscordBot } from '../../plugins/withAuthDiscordBot'
import { hashDiscordLinkCode } from './discordLink'

const snowflake = t.String({ pattern: '^[0-9]{1,20}$' })
const eventId = t.String({ pattern: '^[0-9]{1,30}$' })

function jsonSafe(value: unknown): unknown {
	if (typeof value === 'bigint') return value.toString()
	if (Array.isArray(value)) return value.map(jsonSafe)
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, jsonSafe(entry)]),
		)
	}
	return value
}

const detail = (operationId: string, summary: string) => ({
	operationId,
	summary,
	security: DISCORD_BOT_SECURITY,
	tags: [OPENAPI_TAG.discordBot],
})

export const discordBotRoutes = new Elysia({ prefix: '/discord-bot' })
	.use(withAuthDiscordBot)
	.post(
		'/link/redeem',
		async ({ body, set }) => {
			const result = await consumeDiscordLinkCode(
				hashDiscordLinkCode(body.code),
				BigInt(body.discordId),
			)
			if (result.status !== 'linked') {
				set.status = result.status === 'conflict' ? 409 : 400
			}
			return jsonSafe(result)
		},
		{
			body: t.Object({ code: t.String({ pattern: '^[0-9]{8}$' }), discordId: snowflake }),
			detail: detail('redeemDiscordLinkCode', 'Redeem a one-time Discord account link code'),
		},
	)
	.get(
		'/users/:discordId',
		async ({ params }) => jsonSafe(await getDiscordUserState(BigInt(params.discordId))),
		{
			params: t.Object({ discordId: snowflake }),
			detail: detail('getDiscordBotUser', 'Get linked user and bot preferences'),
		},
	)
	.delete(
		'/users/:discordId/link',
		async ({ params }) => jsonSafe(await unlinkDiscordByDiscordId(BigInt(params.discordId))),
		{
			params: t.Object({ discordId: snowflake }),
			detail: detail('unlinkDiscordBotUser', 'Unlink invoking Discord user'),
		},
	)
	.patch(
		'/users/:discordId/preferences',
		async ({ params, body }) =>
			jsonSafe(
				await setDiscordUserPreference(
					BigInt(params.discordId),
					body.pingOnWorldRecordLoss,
				),
			),
		{
			params: t.Object({ discordId: snowflake }),
			body: t.Object({ pingOnWorldRecordLoss: t.Boolean() }),
			detail: detail(
				'updateDiscordBotUserPreferences',
				'Update Discord notification preferences',
			),
		},
	)
	.post(
		'/users/:discordId/watches',
		async ({ params, body }) =>
			jsonSafe(
				await addDiscordWatch({
					discordId: BigInt(params.discordId),
					kind: body.kind,
					targetId: body.targetId,
				}),
			),
		{
			params: t.Object({ discordId: snowflake }),
			body: t.Object({
				kind: t.UnionEnum(DISCORD_WATCH_KINDS),
				targetId: t.String({ minLength: 1, maxLength: 128 }),
			}),
			detail: detail('addDiscordBotWatch', 'Add or resume a Discord DM watch'),
		},
	)
	.delete(
		'/users/:discordId/watches/:watchId',
		async ({ params }) =>
			jsonSafe(
				await removeDiscordWatch({
					discordId: BigInt(params.discordId),
					id: BigInt(params.watchId),
				}),
			),
		{
			params: t.Object({ discordId: snowflake, watchId: eventId }),
			detail: detail('removeDiscordBotWatch', 'Remove a Discord DM watch'),
		},
	)
	.post(
		'/watches/matches',
		async ({ body }) => jsonSafe(await getMatchingDiscordWatches(body.targets)),
		{
			body: t.Object({
				targets: t.Array(
					t.Object({
						kind: t.UnionEnum(DISCORD_WATCH_KINDS),
						targetIds: t.Array(t.String({ minLength: 1, maxLength: 128 }), {
							maxItems: 20,
						}),
					}),
					{ maxItems: 4 },
				),
			}),
			detail: detail('matchDiscordWatches', 'Find active watches matching event targets'),
		},
	)
	.patch(
		'/watches/:watchId/delivery',
		async ({ params, body }) =>
			jsonSafe(
				await updateDiscordWatchDelivery({
					id: BigInt(params.watchId),
					paused: body.paused,
					lastError: body.lastError,
					deliveryKey: body.deliveryKey,
				}),
			),
		{
			params: t.Object({ watchId: eventId }),
			body: t.Object({
				paused: t.Boolean(),
				lastError: t.Union([t.String({ maxLength: 1000 }), t.Null()]),
				deliveryKey: t.Union([t.String({ minLength: 1, maxLength: 128 }), t.Null()]),
			}),
			detail: detail('updateDiscordWatchDelivery', 'Persist DM watch delivery state'),
		},
	)
	.get(
		'/workers/:key/cursor',
		async ({ params }) => jsonSafe(await getDiscordWorkerCursor(params.key)),
		{
			params: t.Object({ key: t.String({ pattern: '^[a-z][a-z0-9_-]{0,31}$' }) }),
			detail: detail('getDiscordWorkerCursor', 'Get durable Discord worker cursor'),
		},
	)
	.post(
		'/workers/:key/cursor',
		async ({ params, body }) =>
			jsonSafe(await advanceDiscordWorkerCursor(params.key, BigInt(body.eventId))),
		{
			params: t.Object({ key: t.String({ pattern: '^[a-z][a-z0-9_-]{0,31}$' }) }),
			body: t.Object({ eventId }),
			detail: detail('advanceDiscordWorkerCursor', 'Advance durable Discord worker cursor'),
		},
	)
	.get('/guild-feeds/enabled', async () => jsonSafe(await getEnabledDiscordGuildFeeds()), {
		detail: detail('getEnabledDiscordGuildFeeds', 'List enabled Discord guild feeds'),
	})
	.get(
		'/guilds/:guildId',
		async ({ params }) => jsonSafe(await getDiscordGuildState(BigInt(params.guildId))),
		{
			params: t.Object({ guildId: snowflake }),
			detail: detail('getDiscordGuildConfig', 'Get Discord guild configuration'),
		},
	)
	.put(
		'/guilds/:guildId/linked-role',
		async ({ params, body }) =>
			jsonSafe(
				await setDiscordGuildLinkedRole(
					BigInt(params.guildId),
					body.roleId === null ? null : BigInt(body.roleId),
				),
			),
		{
			params: t.Object({ guildId: snowflake }),
			body: t.Object({ roleId: t.Union([snowflake, t.Null()]) }),
			detail: detail('setDiscordGuildLinkedRole', 'Configure linked-account role'),
		},
	)
	.put(
		'/guilds/:guildId/feeds/:kind',
		async ({ params, body }) =>
			jsonSafe(
				await setDiscordGuildFeed({
					guildId: BigInt(params.guildId),
					kind: params.kind,
					channelId: BigInt(body.channelId),
					enabled: body.enabled,
				}),
			),
		{
			params: t.Object({ guildId: snowflake, kind: t.UnionEnum(DISCORD_FEED_KINDS) }),
			body: t.Object({ channelId: snowflake, enabled: t.Boolean() }),
			detail: detail('setDiscordGuildFeed', 'Configure one Discord guild feed'),
		},
	)
	.post(
		'/guilds/:guildId/feeds/:kind/cursor',
		async ({ params, body }) =>
			jsonSafe(
				await advanceDiscordGuildFeedCursor({
					guildId: BigInt(params.guildId),
					kind: params.kind,
					eventId: BigInt(body.eventId),
				}),
			),
		{
			params: t.Object({ guildId: snowflake, kind: t.UnionEnum(DISCORD_FEED_KINDS) }),
			body: t.Object({ eventId }),
			detail: detail('advanceDiscordGuildFeed', 'Advance durable Discord feed cursor'),
		},
	)
	.put(
		'/guilds/:guildId/digest',
		async ({ params, body }) =>
			jsonSafe(
				await setDiscordDigest({
					guildId: BigInt(params.guildId),
					channelId: BigInt(body.channelId),
					dailyEnabled: body.dailyEnabled,
					weeklyEnabled: body.weeklyEnabled,
					deliveryHour: body.deliveryHour,
					weeklyDay: body.weeklyDay,
					nextDeliveryAt: body.nextDeliveryAt,
				}),
			),
		{
			params: t.Object({ guildId: snowflake }),
			body: t.Object({
				channelId: snowflake,
				dailyEnabled: t.Boolean(),
				weeklyEnabled: t.Boolean(),
				deliveryHour: t.Integer({ minimum: 0, maximum: 23 }),
				weeklyDay: t.Integer({ minimum: 0, maximum: 6 }),
				nextDeliveryAt: t.Union([t.String({ format: 'date-time' }), t.Null()]),
			}),
			detail: detail('setDiscordGuildDigest', 'Configure Discord guild digests'),
		},
	)
	.put(
		'/guilds/:guildId/deliveries/:sourceEventId',
		async ({ params, body }) =>
			jsonSafe(
				await setDiscordDelivery({
					guildId: BigInt(params.guildId),
					eventId: BigInt(params.sourceEventId),
					channelId: BigInt(body.channelId),
					messageId: body.messageId === null ? null : BigInt(body.messageId),
					status: body.status,
					lastError: body.lastError,
				}),
			),
		{
			params: t.Object({ guildId: snowflake, sourceEventId: eventId }),
			body: t.Object({
				channelId: snowflake,
				messageId: t.Union([snowflake, t.Null()]),
				status: t.UnionEnum(['pending', 'sent', 'failed'] as const),
				lastError: t.Optional(t.Union([t.String({ maxLength: 1000 }), t.Null()])),
			}),
			detail: detail('setDiscordDelivery', 'Record Discord event delivery state'),
		},
	)
	.get(
		'/guilds/:guildId/deliveries/:sourceEventId',
		async ({ params }) =>
			jsonSafe(
				await getDiscordDelivery(BigInt(params.guildId), BigInt(params.sourceEventId)),
			),
		{
			params: t.Object({ guildId: snowflake, sourceEventId: eventId }),
			detail: detail('getDiscordDelivery', 'Read Discord event delivery state'),
		},
	)
	.put(
		'/guilds/:guildId/tournaments/:tournamentId/message',
		async ({ params, body }) =>
			jsonSafe(
				await setDiscordTournamentMessage({
					guildId: BigInt(params.guildId),
					idTournament: Number(params.tournamentId),
					channelId: BigInt(body.channelId),
					messageId: BigInt(body.messageId),
					contentHash: body.contentHash,
				}),
			),
		{
			params: t.Object({
				guildId: snowflake,
				tournamentId: t.String({ pattern: '^[1-9][0-9]*$' }),
			}),
			body: t.Object({
				channelId: snowflake,
				messageId: snowflake,
				contentHash: t.String({ minLength: 16, maxLength: 128 }),
			}),
			detail: detail(
				'setDiscordTournamentMessage',
				'Persist tournament embed message identity',
			),
		},
	)
