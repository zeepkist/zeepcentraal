import type { Client } from 'discord.js'
import type { CommandContext } from './commands/context'
import { buildTournamentMessages } from './commands/utils/tournament'
import { discordErrorSummary } from './errors'
import { createProductionFeedScheduler } from './feeds/create-production-feed-scheduler'
import { deliverWatches } from './feeds/deliver-watches'
import type { FeedScheduler } from './feeds/feed-scheduler'
import { processActivityWatches } from './feeds/process-activity-watches'
import { activityFeedKind, processFeed } from './feeds/process-feed'
import { updateTournament } from './feeds/update-tournament'
import type { DiscordActivityEvent, DiscordGuildFeed, DiscordGuildState } from './types'

export class FeedService {
	private tournamentTimer?: ReturnType<typeof setInterval>
	private liveSubscription?: { unsubscribe: () => void }
	private activityQueue = Promise.resolve()
	private tournamentPolling = false
	private tournamentWatchKeys = new Map<number, string>()

	constructor(
		private readonly client: Client,
		private readonly context: CommandContext,
		private readonly scheduler: FeedScheduler = createProductionFeedScheduler(),
	) {}

	start() {
		this.tournamentTimer = this.scheduler.setInterval(() => void this.pollTournaments(), 60_000)
		this.liveSubscription = this.context.graphql.subscribeToActivityEvents((events) => {
			void this.enqueueActivityEvents(events)
		})
		void this.pollTournaments()
	}

	enqueueActivityEvents(events: DiscordActivityEvent[]) {
		this.activityQueue = this.activityQueue
			.then(() => this.processActivityEvents(events))
			.catch((error) => {
				console.error(
					'Discord activity event processing failed',
					discordErrorSummary(error),
				)
			})
		return this.activityQueue
	}

	async processActivityEvents(events: DiscordActivityEvent[]) {
		try {
			await processActivityWatches(this.client, events, this.context)
		} catch (error) {
			console.error('Discord activity watch processing failed', discordErrorSummary(error))
		}

		const feedEvents = events.filter((event) => activityFeedKind(event) !== undefined)
		if (feedEvents.length === 0) return

		let feeds: DiscordGuildFeed[]
		try {
			feeds = await this.context.backend.enabledGuildFeeds()
		} catch (error) {
			console.error('Discord activity feed lookup failed', discordErrorSummary(error))
			return
		}

		const guildFeeds = new Map<string, DiscordGuildFeed[]>()
		for (const feed of feeds) {
			if (feed.kind === 'totw' || feed.kind === 'totm') continue
			const entries = guildFeeds.get(feed.guildId) ?? []
			entries.push(feed)
			guildFeeds.set(feed.guildId, entries)
		}

		await Promise.all(
			[...guildFeeds].map(async ([guildId, entries]) => {
				const guild = this.client.guilds.cache.get(guildId)
				if (!guild) return
				for (const feed of entries) {
					try {
						await processFeed(guild, feed, feedEvents, this.context)
					} catch (error) {
						const channel = guild.channels.cache.get(feed.channelId)
						console.error(
							'Discord activity feed delivery failed',
							{
								guildId: guild.id,
								guildName: guild.name,
								channelId: feed.channelId,
								channelName: channel?.name ?? null,
								feedKind: feed.kind,
							},
							discordErrorSummary(error),
						)
					}
				}
			}),
		)
	}

	async pollTournaments() {
		if (this.tournamentPolling) return
		this.tournamentPolling = true
		try {
			let snapshots: Awaited<ReturnType<typeof buildTournamentMessages>>
			try {
				snapshots = await buildTournamentMessages(this.context)
			} catch (error) {
				console.error('Discord tournament feed poll failed', discordErrorSummary(error))
				return
			}
			for (const type of [0, 1] as const) {
				const snapshot = snapshots.get(type)
				if (!snapshot) {
					console.warn('Discord tournament snapshot missing', {
						feedKind: type === 0 ? 'totw' : 'totm',
					})
					continue
				}
				const deliveryKey = `tournament:${snapshot.tournamentId}:${snapshot.contentHash}`
				if (this.tournamentWatchKeys.get(type) !== deliveryKey) {
					try {
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
					} catch (error) {
						console.error(
							'Discord tournament watch delivery failed',
							{ feedKind: type === 0 ? 'totw' : 'totm' },
							discordErrorSummary(error),
						)
					}
				}
			}
			for (const guild of this.client.guilds.cache.values()) {
				let state: DiscordGuildState
				try {
					state = await this.context.backend.guild(guild.id)
				} catch (error) {
					console.error(
						'Discord tournament feed poll failed',
						{
							guildId: guild.id,
							guildName: guild.name,
							channelId: null,
							channelName: null,
							feedKind: null,
						},
						discordErrorSummary(error),
					)
					continue
				}
				for (const type of [0, 1] as const) {
					const snapshot = snapshots.get(type)
					if (!snapshot) continue
					try {
						await updateTournament(guild, state, type, snapshot, this.context)
					} catch (error) {
						const feedKind = type === 0 ? 'totw' : 'totm'
						const feed = state.feeds.find(
							(entry) => entry.kind === feedKind && entry.enabled,
						)
						const channel = feed ? guild.channels.cache.get(feed.channelId) : null
						console.error(
							'Discord tournament feed poll failed',
							{
								guildId: guild.id,
								guildName: guild.name,
								channelId: feed?.channelId ?? null,
								channelName: channel?.name ?? null,
								feedKind,
							},
							discordErrorSummary(error),
						)
					}
				}
			}
		} finally {
			this.tournamentPolling = false
		}
	}

	stop() {
		if (this.tournamentTimer) this.scheduler.clearInterval(this.tournamentTimer)
		this.liveSubscription?.unsubscribe()
	}
}
