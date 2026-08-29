import { getMeter, withActiveSpan } from '@zeepkist/telemetry'
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

const meter = getMeter('zeepcentraal-discord')
const activityDuration = meter.createHistogram('discord.activity.duration', { unit: 's' })
const pollDuration = meter.createHistogram('discord.poll.duration', { unit: 's' })
const operationOutcomes = meter.createCounter('discord.background.operations')

export class FeedService {
	private tournamentTimer?: ReturnType<typeof setInterval>
	private liveSubscription?: { unsubscribe: () => void }
	private activityDrain?: Promise<void>
	private readonly pendingActivityEvents = new Map<string, DiscordActivityEvent>()
	private lastProcessedActivityId?: bigint
	private tournamentPolling = false
	private tournamentDrain?: Promise<void>
	private tournamentWatchKeys = new Map<number, string>()
	private stopped = false

	constructor(
		private readonly client: Client,
		private readonly context: CommandContext,
		private readonly scheduler: FeedScheduler = createProductionFeedScheduler(),
	) {}

	start() {
		this.stopped = false
		this.tournamentTimer = this.scheduler.setInterval(() => void this.pollTournaments(), 60_000)
		this.liveSubscription = this.context.graphql.subscribeToActivityEvents((events) => {
			void this.enqueueActivityEvents(events)
		})
		void this.pollTournaments()
	}

	enqueueActivityEvents(events: DiscordActivityEvent[]) {
		if (this.stopped) return Promise.resolve()
		for (const event of events) {
			const id = activityId(event.id)
			if (id !== undefined && this.lastProcessedActivityId !== undefined) {
				if (id <= this.lastProcessedActivityId) continue
			}
			this.pendingActivityEvents.set(event.id, event)
		}
		while (this.pendingActivityEvents.size > 1_000) {
			const oldest = this.pendingActivityEvents.keys().next().value
			if (!oldest) break
			this.pendingActivityEvents.delete(oldest)
		}

		this.activityDrain ??= this.drainActivityEvents().finally(() => {
			this.activityDrain = undefined
		})
		return this.activityDrain
	}

	private async drainActivityEvents() {
		while (this.pendingActivityEvents.size > 0) {
			const events = [...this.pendingActivityEvents.values()].sort((left, right) =>
				compareActivityIds(left.id, right.id),
			)
			this.pendingActivityEvents.clear()
			try {
				await this.processActivityEvents(events)
			} catch (error) {
				console.error(
					'Discord activity event processing failed',
					discordErrorSummary(error),
				)
			}
			for (const event of events) {
				const id = activityId(event.id)
				if (id !== undefined && (this.lastProcessedActivityId ?? -1n) < id) {
					this.lastProcessedActivityId = id
				}
			}
		}
	}

	async processActivityEvents(events: DiscordActivityEvent[]) {
		const startedAt = performance.now()
		try {
			await withActiveSpan('discord.activity.process', async (span) => {
				span.addEvent('activity.batch', { 'activity.event.count': events.length })
				await this.processActivityEventsBatch(events)
			})
			operationOutcomes.add(1, { operation: 'activity', outcome: 'success' })
		} catch (error) {
			operationOutcomes.add(1, { operation: 'activity', outcome: 'error' })
			throw error
		} finally {
			activityDuration.record((performance.now() - startedAt) / 1000)
		}
	}

	private async processActivityEventsBatch(events: DiscordActivityEvent[]) {
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

		await runWithConcurrency([...guildFeeds], 4, async ([guildId, entries]) => {
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
		})
	}

	async pollTournaments() {
		if (this.stopped) return
		if (this.tournamentPolling) return
		const startedAt = performance.now()
		try {
			await withActiveSpan('discord.tournament.poll', async (span) => {
				span.addEvent('poll.started', {
					'discord.guild.count': this.client.guilds.cache.size,
				})
				await this.pollTournamentsActive()
			})
			operationOutcomes.add(1, { operation: 'tournament_poll', outcome: 'success' })
		} catch (error) {
			operationOutcomes.add(1, { operation: 'tournament_poll', outcome: 'error' })
			throw error
		} finally {
			pollDuration.record((performance.now() - startedAt) / 1000)
		}
	}

	private async pollTournamentsActive() {
		this.tournamentPolling = true
		const completion = Promise.withResolvers<void>()
		this.tournamentDrain = completion.promise
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
			completion.resolve()
			this.tournamentDrain = undefined
		}
	}

	async stop() {
		this.stopped = true
		if (this.tournamentTimer) this.scheduler.clearInterval(this.tournamentTimer)
		this.tournamentTimer = undefined
		this.liveSubscription?.unsubscribe()
		this.liveSubscription = undefined
		this.pendingActivityEvents.clear()
		await Promise.allSettled([this.activityDrain, this.tournamentDrain])
		this.tournamentWatchKeys.clear()
	}

	stats() {
		return { activityQueueDepth: this.pendingActivityEvents.size }
	}
}

function activityId(value: string) {
	try {
		return BigInt(value)
	} catch {
		return undefined
	}
}

function compareActivityIds(left: string, right: string) {
	const leftId = activityId(left)
	const rightId = activityId(right)
	if (leftId === undefined || rightId === undefined) return left.localeCompare(right)
	return leftId < rightId ? -1 : leftId > rightId ? 1 : 0
}

async function runWithConcurrency<T>(
	items: T[],
	concurrency: number,
	work: (item: T) => Promise<void>,
) {
	let index = 0
	async function worker() {
		while (index < items.length) {
			const item = items[index++]
			if (item !== undefined) await work(item)
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
}
