import type { Client } from 'discord.js'
import type { CommandContext } from './commands/context'
import { buildTournamentMessages } from './commands/utils/tournament'
import { discordErrorSummary } from './errors'
import { createProductionFeedScheduler } from './feeds/create-production-feed-scheduler'
import { deliverWatches } from './feeds/deliver-watches'
import type { FeedScheduler } from './feeds/feed-scheduler'
import { processActivityWatches } from './feeds/process-activity-watches'
import { processFeed } from './feeds/process-feed'
import { updateTournament } from './feeds/update-tournament'
import type { DiscordGuildState } from './types'

const ACTIVITY_SUBSCRIPTION_REFRESH_MS = 55 * 60_000

export class FeedService {
	private activityTimer?: ReturnType<typeof setInterval>
	private activitySubscriptionTimer?: ReturnType<typeof setInterval>
	private tournamentTimer?: ReturnType<typeof setInterval>
	private liveSubscription?: { unsubscribe: () => void }
	private polling = false
	private tournamentPolling = false
	private tournamentWatchKeys = new Map<number, string>()

	constructor(
		private readonly client: Client,
		private readonly context: CommandContext,
		private readonly scheduler: FeedScheduler = createProductionFeedScheduler(),
	) {}

	start() {
		this.activityTimer = this.scheduler.setInterval(() => void this.pollActivity(), 20_000)
		this.tournamentTimer = this.scheduler.setInterval(() => void this.pollTournaments(), 60_000)
		this.activitySubscriptionTimer = this.scheduler.setInterval(() => {
			this.context.graphql.restartLiveConnection()
			void this.pollActivity()
		}, ACTIVITY_SUBSCRIPTION_REFRESH_MS)
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
				console.error('Discord activity watch poll failed', discordErrorSummary(error))
			}
			for (const guild of this.client.guilds.cache.values()) {
				const state = await this.context.backend.guild(guild.id)
				for (const kind of ['workshop', 'world_record', 'rank'] as const) {
					await processFeed(guild, state, kind, this.context)
				}
			}
		} catch (error) {
			console.error('Discord activity feed poll failed', discordErrorSummary(error))
		} finally {
			this.polling = false
		}
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
		if (this.activityTimer) this.scheduler.clearInterval(this.activityTimer)
		if (this.activitySubscriptionTimer)
			this.scheduler.clearInterval(this.activitySubscriptionTimer)
		if (this.tournamentTimer) this.scheduler.clearInterval(this.tournamentTimer)
		this.liveSubscription?.unsubscribe()
	}
}
