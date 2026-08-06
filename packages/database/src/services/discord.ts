import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { db } from '../client'
import {
	discordActivityEvent,
	discordDelivery,
	discordDigest,
	discordGuildConfig,
	discordGuildFeed,
	discordLinkCode,
	discordOAuthLinkState,
	discordTournamentMessage,
	discordUserPreference,
	discordWatch,
	discordWorkerState,
	user,
} from '../schema'

export const DISCORD_FEED_KINDS = ['workshop', 'world_record', 'rank', 'totw', 'totm'] as const
export type DiscordFeedKind = (typeof DISCORD_FEED_KINDS)[number]
export const DISCORD_WATCH_KINDS = ['player', 'level', 'author', 'tournament'] as const
export type DiscordWatchKind = (typeof DISCORD_WATCH_KINDS)[number]

export async function latestDiscordActivityEventId() {
	const [result] = await db
		.select({ id: sql<bigint>`COALESCE(MAX(${discordActivityEvent.id}), 0)::bigint` })
		.from(discordActivityEvent)
	return result?.id ?? 0n
}

export async function createDiscordLinkCode(input: {
	codeHash: string
	idUser: number
	expiresAt: string
}) {
	return db.transaction(async (tx) => {
		await tx
			.delete(discordLinkCode)
			.where(
				or(
					eq(discordLinkCode.idUser, input.idUser),
					lt(discordLinkCode.expiresAt, new Date().toISOString()),
				),
			)
		const [created] = await tx.insert(discordLinkCode).values(input).returning()
		return created
	})
}

export type DiscordLinkResult =
	| { status: 'linked'; idUser: number; steamId: bigint | null }
	| { status: 'expired' | 'invalid' | 'consumed' | 'conflict' }

export async function consumeDiscordLinkCode(
	codeHash: string,
	discordId: bigint,
): Promise<DiscordLinkResult> {
	return db.transaction(async (tx) => {
		const [code] = await tx
			.select()
			.from(discordLinkCode)
			.where(eq(discordLinkCode.codeHash, codeHash))
			.for('update')
		if (!code) return { status: 'invalid' }
		if (code.consumedAt) return { status: 'consumed' }
		if (new Date(code.expiresAt).getTime() <= Date.now()) return { status: 'expired' }

		const [existing] = await tx
			.select({ id: user.id })
			.from(user)
			.where(and(eq(user.discordId, discordId), gt(user.discordId, 0n)))
			.limit(1)
		if (existing && existing.id !== code.idUser) return { status: 'conflict' }

		const [linked] = await tx
			.update(user)
			.set({ discordId, dateUpdated: new Date().toISOString() })
			.where(
				and(
					eq(user.id, code.idUser),
					or(
						isNull(user.discordId),
						eq(user.discordId, -1n),
						eq(user.discordId, discordId),
					),
				),
			)
			.returning({ idUser: user.id, steamId: user.steamId })
		if (!linked) return { status: 'conflict' }

		await tx
			.update(discordLinkCode)
			.set({ consumedAt: new Date().toISOString() })
			.where(eq(discordLinkCode.codeHash, codeHash))
		return { status: 'linked', ...linked }
	})
}

export async function createDiscordOAuthLinkState(input: {
	stateHash: string
	idUser: number
	expiresAt: string
}) {
	await db
		.delete(discordOAuthLinkState)
		.where(
			or(
				eq(discordOAuthLinkState.idUser, input.idUser),
				lt(discordOAuthLinkState.expiresAt, new Date().toISOString()),
			),
		)
	const [created] = await db.insert(discordOAuthLinkState).values(input).returning()
	return created
}

export async function consumeDiscordOAuthLinkState(
	stateHash: string,
	discordId: bigint,
): Promise<DiscordLinkResult> {
	return db.transaction(async (tx) => {
		const [state] = await tx
			.select()
			.from(discordOAuthLinkState)
			.where(eq(discordOAuthLinkState.stateHash, stateHash))
			.for('update')
		if (!state) return { status: 'invalid' }
		if (state.consumedAt) return { status: 'consumed' }
		if (new Date(state.expiresAt).getTime() <= Date.now()) return { status: 'expired' }

		const [existing] = await tx
			.select({ id: user.id })
			.from(user)
			.where(and(eq(user.discordId, discordId), gt(user.discordId, 0n)))
			.limit(1)
		if (existing && existing.id !== state.idUser) return { status: 'conflict' }

		const [linked] = await tx
			.update(user)
			.set({ discordId, dateUpdated: new Date().toISOString() })
			.where(
				and(
					eq(user.id, state.idUser),
					or(
						isNull(user.discordId),
						eq(user.discordId, -1n),
						eq(user.discordId, discordId),
					),
				),
			)
			.returning({ idUser: user.id, steamId: user.steamId })
		if (!linked) return { status: 'conflict' }

		await tx
			.update(discordOAuthLinkState)
			.set({ consumedAt: new Date().toISOString() })
			.where(eq(discordOAuthLinkState.stateHash, stateHash))
		return { status: 'linked', ...linked }
	})
}

export async function unlinkDiscordBySteamId(steamId: string) {
	const [unlinked] = await db
		.update(user)
		.set({ discordId: -1n, dateUpdated: new Date().toISOString() })
		.where(eq(user.steamId, BigInt(steamId)))
		.returning({ idUser: user.id, discordId: user.discordId })
	return unlinked
}

export async function unlinkDiscordByDiscordId(discordId: bigint) {
	const [unlinked] = await db
		.update(user)
		.set({ discordId: -1n, dateUpdated: new Date().toISOString() })
		.where(eq(user.discordId, discordId))
		.returning({ idUser: user.id, discordId: user.discordId })
	return unlinked
}

export async function getDiscordGuildState(guildId: bigint) {
	const [config, feeds, digest, tournamentMessages] = await Promise.all([
		db.query.discordGuildConfig.findFirst({ where: eq(discordGuildConfig.guildId, guildId) }),
		db.query.discordGuildFeed.findMany({
			where: eq(discordGuildFeed.guildId, guildId),
			orderBy: [asc(discordGuildFeed.kind)],
		}),
		db.query.discordDigest.findFirst({ where: eq(discordDigest.guildId, guildId) }),
		db.query.discordTournamentMessage.findMany({
			where: eq(discordTournamentMessage.guildId, guildId),
		}),
	])
	return { config: config ?? null, feeds, digest: digest ?? null, tournamentMessages }
}

export async function setDiscordGuildLinkedRole(guildId: bigint, linkedRoleId: bigint | null) {
	const [updated] = await db
		.insert(discordGuildConfig)
		.values({ guildId, linkedRoleId })
		.onConflictDoUpdate({
			target: discordGuildConfig.guildId,
			set: { linkedRoleId, dateUpdated: new Date().toISOString() },
		})
		.returning()
	return updated
}

export async function setDiscordGuildFeed(input: {
	guildId: bigint
	kind: DiscordFeedKind
	channelId: bigint
	enabled: boolean
	cursorEventId?: bigint
}) {
	const cursorEventId = input.cursorEventId ?? (await latestDiscordActivityEventId())
	const [updated] = await db
		.insert(discordGuildFeed)
		.values({ ...input, cursorEventId })
		.onConflictDoUpdate({
			target: [discordGuildFeed.guildId, discordGuildFeed.kind],
			set: {
				channelId: input.channelId,
				enabled: input.enabled,
				cursorEventId,
				dateUpdated: new Date().toISOString(),
			},
		})
		.returning()
	return updated
}

export async function advanceDiscordGuildFeedCursor(input: {
	guildId: bigint
	kind: DiscordFeedKind
	eventId: bigint
}) {
	const [updated] = await db
		.update(discordGuildFeed)
		.set({ cursorEventId: input.eventId, dateUpdated: new Date().toISOString() })
		.where(
			and(
				eq(discordGuildFeed.guildId, input.guildId),
				eq(discordGuildFeed.kind, input.kind),
				lt(discordGuildFeed.cursorEventId, input.eventId),
			),
		)
		.returning()
	return updated
}

export async function getDiscordUserState(discordId: bigint) {
	const [linkedUser, preference, watches] = await Promise.all([
		db.query.user.findFirst({ where: eq(user.discordId, discordId) }),
		db.query.discordUserPreference.findFirst({
			where: eq(discordUserPreference.discordId, discordId),
		}),
		db.query.discordWatch.findMany({
			where: eq(discordWatch.discordId, discordId),
			orderBy: [desc(discordWatch.dateCreated)],
		}),
	])
	return { linkedUser: linkedUser ?? null, preference: preference ?? null, watches }
}

export async function setDiscordUserPreference(discordId: bigint, pingOnWorldRecordLoss: boolean) {
	const [updated] = await db
		.insert(discordUserPreference)
		.values({ discordId, pingOnWorldRecordLoss })
		.onConflictDoUpdate({
			target: discordUserPreference.discordId,
			set: { pingOnWorldRecordLoss, dateUpdated: new Date().toISOString() },
		})
		.returning()
	return updated
}

export async function addDiscordWatch(input: {
	discordId: bigint
	kind: DiscordWatchKind
	targetId: string
}) {
	const targetId = input.targetId.trim().toLowerCase()
	const [watch] = await db
		.insert(discordWatch)
		.values({ ...input, targetId })
		.onConflictDoUpdate({
			target: [discordWatch.discordId, discordWatch.kind, discordWatch.targetId],
			set: { paused: false, lastError: null, dateUpdated: new Date().toISOString() },
		})
		.returning()
	return watch
}

export async function removeDiscordWatch(input: { discordId: bigint; id: bigint }) {
	const [removed] = await db
		.delete(discordWatch)
		.where(and(eq(discordWatch.discordId, input.discordId), eq(discordWatch.id, input.id)))
		.returning()
	return removed
}

export async function getDiscordWorkerCursor(key: string) {
	const cursorEventId = await latestDiscordActivityEventId()
	const [state] = await db
		.insert(discordWorkerState)
		.values({ key, cursorEventId })
		.onConflictDoNothing()
		.returning()
	if (state) return state
	return db.query.discordWorkerState.findFirst({ where: eq(discordWorkerState.key, key) })
}

export async function advanceDiscordWorkerCursor(key: string, eventId: bigint) {
	const [state] = await db
		.update(discordWorkerState)
		.set({ cursorEventId: eventId, dateUpdated: new Date().toISOString() })
		.where(and(eq(discordWorkerState.key, key), lt(discordWorkerState.cursorEventId, eventId)))
		.returning()
	return state
}

export async function getMatchingDiscordWatches(
	targets: Array<{ kind: DiscordWatchKind; targetIds: string[] }>,
) {
	const filters = targets
		.filter((target) => target.targetIds.length > 0)
		.map((target) =>
			and(
				eq(discordWatch.kind, target.kind),
				inArray(discordWatch.targetId, [
					...new Set(target.targetIds.map((targetId) => targetId.toLowerCase())),
				]),
			),
		)
	if (filters.length === 0) return []
	return db
		.select()
		.from(discordWatch)
		.where(and(eq(discordWatch.paused, false), or(...filters)))
}

export async function updateDiscordWatchDelivery(input: {
	id: bigint
	paused: boolean
	lastError: string | null
	deliveryKey: string | null
}) {
	const [watch] = await db
		.update(discordWatch)
		.set({
			paused: input.paused,
			lastError: input.lastError,
			lastDeliveryKey: input.deliveryKey,
			dateUpdated: new Date().toISOString(),
		})
		.where(eq(discordWatch.id, input.id))
		.returning()
	return watch
}

export async function setDiscordDigest(input: {
	guildId: bigint
	channelId: bigint
	dailyEnabled: boolean
	weeklyEnabled: boolean
	deliveryHour: number
	weeklyDay: number
	nextDeliveryAt: string | null
}) {
	const [updated] = await db
		.insert(discordDigest)
		.values(input)
		.onConflictDoUpdate({
			target: discordDigest.guildId,
			set: { ...input, dateUpdated: new Date().toISOString() },
		})
		.returning()
	return updated
}

export async function setDiscordTournamentMessage(input: {
	guildId: bigint
	idTournament: number
	channelId: bigint
	messageId: bigint
	contentHash: string
}) {
	const [updated] = await db
		.insert(discordTournamentMessage)
		.values(input)
		.onConflictDoUpdate({
			target: [discordTournamentMessage.guildId, discordTournamentMessage.idTournament],
			set: { ...input, dateUpdated: new Date().toISOString() },
		})
		.returning()
	return updated
}

export async function getDiscordDeliveries(guildId: bigint, eventIds: bigint[]) {
	if (eventIds.length === 0) return []
	return db
		.select()
		.from(discordDelivery)
		.where(
			and(eq(discordDelivery.guildId, guildId), inArray(discordDelivery.eventId, eventIds)),
		)
}

export async function getDiscordDelivery(guildId: bigint, eventId: bigint) {
	return db.query.discordDelivery.findFirst({
		where: and(eq(discordDelivery.guildId, guildId), eq(discordDelivery.eventId, eventId)),
	})
}

export async function setDiscordDelivery(input: {
	guildId: bigint
	eventId: bigint
	channelId: bigint
	messageId?: bigint | null
	status: 'pending' | 'sent' | 'failed'
	lastError?: string | null
}) {
	const [updated] = await db
		.insert(discordDelivery)
		.values(input)
		.onConflictDoUpdate({
			target: [discordDelivery.guildId, discordDelivery.eventId],
			set: { ...input, dateUpdated: new Date().toISOString() },
		})
		.returning()
	return updated
}

export async function insertDiscordRankBatch(
	changes: Array<{ idUser: number; previousRank: number; rank: number }>,
) {
	if (changes.length === 0) return null
	const [event] = await db
		.insert(discordActivityEvent)
		.values({
			kind: 'rank_batch',
			payload: { changes },
		})
		.returning()
	return event
}
