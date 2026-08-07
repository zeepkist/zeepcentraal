import type { Client, Guild, GuildTextBasedChannel, MessageCreateOptions } from 'discord.js'
import type { CommandContext } from './commands/context'
import { buildTournamentMessage } from './commands/utils/tournament.handler'
import { baseEmbed, formatTime, playerLabel, safeMentions, truncate } from './format'
import type { DiscordActivityEvent, DiscordFeedKind, DiscordGuildState } from './types'

const EVENT_FEED: Partial<Record<DiscordActivityEvent['kind'], DiscordFeedKind>> = {
	workshop: 'workshop',
	world_record: 'world_record',
	rank_batch: 'rank',
}

export type FeedScheduler = {
	clearInterval: typeof clearInterval
	setInterval: typeof setInterval
}

export function createProductionFeedScheduler(): FeedScheduler {
	return { clearInterval, setInterval }
}

type Watch = Awaited<ReturnType<CommandContext['backend']['matchingWatches']>>[number]

export function aliases(user: DiscordActivityEvent['user']) {
	if (!user) return []
	return [user.id, user.steamId, user.discordId, user.steamName]
		.filter((value): value is string | number | bigint => value !== null && value !== undefined)
		.map(String)
}

export function eventWatchTargets(event: DiscordActivityEvent) {
	const item = event.level?.levelItems.nodes[0]
	const rankUserIds = Array.isArray(event.payload?.changes)
		? (event.payload.changes as Array<{ idUser?: unknown }>)
				.map((change) => change.idUser)
				.filter((value): value is string | number =>
					['string', 'number'].includes(typeof value),
				)
				.map(String)
		: []
	return [
		{
			kind: 'player' as const,
			targetIds: [...aliases(event.user), ...aliases(event.previousUser), ...rankUserIds],
		},
		{
			kind: 'level' as const,
			targetIds: event.level
				? [String(event.level.id), event.level.xxHash, item?.name ?? '']
				: [],
		},
		{ kind: 'author' as const, targetIds: aliases(item?.author ?? null) },
	]
}

export function permanentDmFailure(error: unknown) {
	const code = (error as { code?: unknown } | null)?.code
	return code === 50007 || code === 50013 || code === 10013
}

export async function deliverWatches(
	client: Client,
	watches: Watch[],
	deliveryKey: string,
	message: MessageCreateOptions,
	context: CommandContext,
) {
	const recipients = new Map<string, Watch[]>()
	for (const watch of watches) {
		if (watch.lastDeliveryKey === deliveryKey) continue
		const entries = recipients.get(watch.discordId) ?? []
		entries.push(watch)
		recipients.set(watch.discordId, entries)
	}
	for (const [discordId, recipientWatches] of recipients) {
		try {
			const recipient = await client.users.fetch(discordId)
			await recipient.send({ ...message, content: undefined, allowedMentions: safeMentions })
			for (const watch of recipientWatches) {
				await context.backend.updateWatchDelivery(watch.id, {
					paused: false,
					lastError: null,
					deliveryKey,
				})
			}
		} catch (error) {
			const paused = permanentDmFailure(error)
			const lastError = error instanceof Error ? error.message.slice(0, 1000) : String(error)
			for (const watch of recipientWatches) {
				await context.backend.updateWatchDelivery(watch.id, {
					paused,
					lastError,
					deliveryKey: null,
				})
			}
			if (!paused) throw error
		}
	}
}

export function eventLevelName(event: DiscordActivityEvent) {
	return event.level?.levelItems.nodes[0]?.name ?? String(event.payload?.name ?? 'Unknown level')
}

export async function rankMessage(event: DiscordActivityEvent, context: CommandContext) {
	const changes = Array.isArray(event.payload?.changes)
		? (event.payload.changes as Array<{ idUser: number; previousRank: number; rank: number }>)
		: []
	const users = await context.graphql.usersByIds(changes.map((change) => change.idUser))
	const rows = changes.slice(0, 40).map((change) => {
		const direction = change.rank < change.previousRank ? '▲' : '▼'
		return `${direction} ${playerLabel(users.get(change.idUser))}: #${change.previousRank} → #${change.rank}`
	})
	return {
		embeds: [
			baseEmbed('Rank changes', truncate(rows.join('\n') || 'Ranking recalculated.', 4000)),
		],
		allowedMentions: safeMentions,
	} satisfies MessageCreateOptions
}

export async function eventMessage(event: DiscordActivityEvent, context: CommandContext) {
	if (event.kind === 'rank_batch') return rankMessage(event, context)
	const levelName = eventLevelName(event)
	const levelUrl = event.level
		? `${context.config.frontendUrl}/level/${event.level.xxHash}`
		: context.config.frontendUrl
	if (event.kind === 'workshop') {
		const item = event.level?.levelItems.nodes[0]
		return {
			embeds: [
				{
					...baseEmbed(
						'New public workshop level',
						`${levelName}\nBy ${playerLabel(item?.author)}`,
					),
					url: levelUrl,
					thumbnail: item?.imageUrl ? { url: item.imageUrl } : undefined,
					fields: [
						{
							name: 'Workshop ID',
							value: String(
								item?.workshopId ?? event.payload?.workshopId ?? 'Unknown',
							),
						},
					],
				},
			],
			allowedMentions: safeMentions,
		} satisfies MessageCreateOptions
	}
	if (event.kind === 'personal_best') {
		return {
			embeds: [
				{
					...baseEmbed(
						`New personal best • ${levelName}`,
						`${playerLabel(event.user)} • ${formatTime(event.record?.time)}`,
					),
					url: levelUrl,
				},
			],
			allowedMentions: safeMentions,
		} satisfies MessageCreateOptions
	}
	if (event.kind === 'vote') {
		return {
			embeds: [
				{
					...baseEmbed(
						`Level vote • ${levelName}`,
						`${playerLabel(event.user)} voted ${String(event.payload?.value ?? 'unknown')}.`,
					),
					url: levelUrl,
				},
			],
			allowedMentions: safeMentions,
		} satisfies MessageCreateOptions
	}
	const stolen = event.previousUser
		? `\nStolen from ${playerLabel(event.previousUser)} (${formatTime(event.previousRecord?.time)})`
		: ''
	const content = event.previousUser?.discordId?.toString()
	const preference = content ? await context.backend.user(content).catch(() => null) : null
	const shouldPing = Boolean(
		content && content !== '-1' && preference?.preference?.pingOnWorldRecordLoss,
	)
	return {
		content: shouldPing ? `<@${content}> your world record was beaten.` : undefined,
		embeds: [
			{
				...baseEmbed(
					`New world record • ${levelName}`,
					`${playerLabel(event.user)} • ${formatTime(event.record?.time)}${stolen}`,
				),
				url: levelUrl,
			},
		],
		allowedMentions: shouldPing ? { users: [content as string], parse: [] } : safeMentions,
	} satisfies MessageCreateOptions
}

export async function sendToChannel(
	guild: Guild,
	channelId: string,
	message: MessageCreateOptions,
): Promise<{ id: string }> {
	const channel = await guild.channels.fetch(channelId)
	if (!channel?.isTextBased() || !('send' in channel))
		throw new Error('Configured channel is unavailable')
	return (channel as GuildTextBasedChannel).send(message)
}

export async function processFeed(
	guild: Guild,
	state: DiscordGuildState,
	kind: DiscordFeedKind,
	context: CommandContext,
) {
	const feed = state.feeds.find((entry) => entry.kind === kind && entry.enabled)
	if (!feed || kind === 'totw' || kind === 'totm') return
	const events = await context.graphql.activityEvents(feed.cursorEventId)
	for (const event of events) {
		if (EVENT_FEED[event.kind] !== kind) {
			await context.backend.advanceFeed(guild.id, kind, event.id)
			continue
		}
		try {
			const delivery = await context.backend.delivery(guild.id, event.id)
			if (delivery?.status === 'sent') {
				await context.backend.advanceFeed(guild.id, kind, event.id)
				continue
			}
			await context.backend.setDelivery({
				guildId: guild.id,
				eventId: event.id,
				channelId: feed.channelId,
				messageId: null,
				status: 'pending',
			})
			const sent = await sendToChannel(
				guild,
				feed.channelId,
				await eventMessage(event, context),
			)
			await context.backend.setDelivery({
				guildId: guild.id,
				eventId: event.id,
				channelId: feed.channelId,
				messageId: sent.id,
				status: 'sent',
			})
			await context.backend.advanceFeed(guild.id, kind, event.id)
		} catch (error) {
			await context.backend.setDelivery({
				guildId: guild.id,
				eventId: event.id,
				channelId: feed.channelId,
				messageId: null,
				status: 'failed',
				lastError: error instanceof Error ? error.message.slice(0, 1000) : String(error),
			})
			throw error
		}
	}
}

export async function processActivityWatches(client: Client, context: CommandContext) {
	const state = await context.backend.workerCursor('watch-events')
	const events = await context.graphql.activityEvents(state.cursorEventId)
	for (const event of events) {
		const watches = await context.backend.matchingWatches(eventWatchTargets(event))
		if (watches.length > 0) {
			await deliverWatches(
				client,
				watches,
				`event:${event.id}`,
				await eventMessage(event, context),
				context,
			)
		}
		await context.backend.advanceWorkerCursor('watch-events', event.id)
	}
}

export async function updateTournament(
	guild: Guild,
	state: DiscordGuildState,
	type: 0 | 1,
	context: CommandContext,
) {
	const kind = type === 0 ? 'totw' : 'totm'
	const feed = state.feeds.find((entry) => entry.kind === kind && entry.enabled)
	if (!feed) return
	const snapshot = await buildTournamentMessage(type, context)
	const existing = state.tournamentMessages?.find(
		(message) => message.idTournament === snapshot.tournamentId,
	)
	if (existing?.contentHash === snapshot.contentHash && existing.channelId === feed.channelId)
		return
	let messageId: string
	if (existing && existing.channelId === feed.channelId) {
		const channel = await guild.channels.fetch(feed.channelId)
		if (!channel?.isTextBased() || !('messages' in channel)) {
			throw new Error('Configured tournament channel is unavailable')
		}
		const message = await (channel as GuildTextBasedChannel).messages.fetch(existing.messageId)
		await message.edit(snapshot.message)
		messageId = message.id
	} else {
		messageId = (await sendToChannel(guild, feed.channelId, snapshot.message)).id
	}
	await context.backend.setTournamentMessage({
		guildId: guild.id,
		tournamentId: snapshot.tournamentId,
		channelId: feed.channelId,
		messageId,
		contentHash: snapshot.contentHash,
	})
}

export class FeedService {
	private activityTimer?: ReturnType<typeof setInterval>
	private tournamentTimer?: ReturnType<typeof setInterval>
	private liveSubscription?: { unsubscribe: () => void }
	private polling = false
	private tournamentWatchKeys = new Map<number, string>()

	constructor(
		private readonly client: Client,
		private readonly context: CommandContext,
		private readonly scheduler: FeedScheduler = createProductionFeedScheduler(),
	) {}

	start() {
		this.activityTimer = this.scheduler.setInterval(() => void this.pollActivity(), 20_000)
		this.tournamentTimer = this.scheduler.setInterval(() => void this.pollTournaments(), 60_000)
		this.liveSubscription = this.context.graphql.subscribeToActivityEvents(() => {
			void this.pollActivity()
		})
		void this.pollActivity()
		void this.pollTournaments()
	}

	async pollActivity() {
		if (this.polling) return
		this.polling = true
		try {
			try {
				await processActivityWatches(this.client, this.context)
			} catch (error) {
				console.error('Discord activity watch poll failed', error)
			}
			for (const guild of this.client.guilds.cache.values()) {
				const state = await this.context.backend.guild(guild.id)
				for (const kind of ['workshop', 'world_record', 'rank'] as const) {
					await processFeed(guild, state, kind, this.context)
				}
			}
		} catch (error) {
			console.error('Discord activity feed poll failed', error)
		} finally {
			this.polling = false
		}
	}

	async pollTournaments() {
		let target:
			| {
					guild: Guild
					state?: DiscordGuildState
					type?: 0 | 1
			  }
			| undefined
		try {
			for (const type of [0, 1] as const) {
				const snapshot = await buildTournamentMessage(type, this.context)
				const deliveryKey = `tournament:${snapshot.tournamentId}:${snapshot.contentHash}`
				if (this.tournamentWatchKeys.get(type) !== deliveryKey) {
					const watches = await this.context.backend.matchingWatches([
						{
							kind: 'tournament',
							targetIds: [
								String(snapshot.tournamentId),
								snapshot.tournamentSlug,
								snapshot.tournamentType,
							],
						},
					])
					await deliverWatches(
						this.client,
						watches,
						deliveryKey,
						snapshot.message,
						this.context,
					)
					this.tournamentWatchKeys.set(type, deliveryKey)
				}
			}
			for (const guild of this.client.guilds.cache.values()) {
				target = { guild }
				const state = await this.context.backend.guild(guild.id)
				for (const type of [0, 1] as const) {
					target = { guild, state, type }
					await updateTournament(guild, state, type, this.context)
				}
			}
		} catch (error) {
			if (!target) {
				console.error('Discord tournament feed poll failed', error)
				return
			}
			const feedKind = target.type === undefined ? null : target.type === 0 ? 'totw' : 'totm'
			const feed = target.state?.feeds.find(
				(entry) => entry.kind === feedKind && entry.enabled,
			)
			const channel = feed ? target.guild.channels.cache.get(feed.channelId) : null
			console.error(
				'Discord tournament feed poll failed',
				{
					guildId: target.guild.id,
					guildName: target.guild.name,
					channelId: feed?.channelId ?? null,
					channelName: channel?.name ?? null,
					feedKind,
				},
				error,
			)
		}
	}

	stop() {
		if (this.activityTimer) this.scheduler.clearInterval(this.activityTimer)
		if (this.tournamentTimer) this.scheduler.clearInterval(this.tournamentTimer)
		this.liveSubscription?.unsubscribe()
	}
}
