import { mock } from 'bun:test'
import type { Client, Guild } from 'discord.js'
import type { DiscordActivityEvent, DiscordGuildState } from '../src/types'
import { linkedUser } from './mocks'

export function createFeedEvent(
	overrides: Partial<DiscordActivityEvent> = {},
): DiscordActivityEvent {
	return {
		id: 'event-1',
		kind: 'world_record',
		levelId: 3,
		userId: 7,
		previousUserId: 8,
		recordId: 9,
		previousRecordId: 10,
		payload: {},
		occurredAt: '2026-08-06T12:00:00Z',
		level: {
			id: 3,
			xxHash: 'level-hash',
			levelItems: {
				nodes: [
					{
						name: 'Fast Track',
						imageUrl: 'https://image.test/level.jpg',
						workshopId: '123',
						author: linkedUser,
					},
				],
			},
			levelPoints: { points: 1_234.1, rating: 4.5 },
			personalBestGlobals: { totalCount: 25 },
		},
		user: linkedUser,
		previousUser: { ...linkedUser, id: 8, steamName: 'Previous', discordId: 'discord-2' },
		record: { id: 9, time: 12.3, modVersion: '1.0' },
		previousRecord: { id: 10, time: 12.4, modVersion: '1.0' },
		...overrides,
	}
}

export function createFeedGuildState(
	overrides: Partial<DiscordGuildState> = {},
): DiscordGuildState {
	return {
		config: null,
		feeds: [],
		digest: null,
		tournamentMessages: [],
		...overrides,
	}
}

export function createFeedGuild(options: { channel?: Record<string, unknown> | null } = {}) {
	const edit = mock(async () => {})
	const send = mock(async () => ({ id: 'message-new' }))
	const message = { id: 'message-old', edit }
	const channel =
		options.channel === undefined
			? {
					id: 'channel',
					isTextBased: () => true,
					messages: { fetch: mock(async () => message) },
					name: 'tournament-feed',
					send,
				}
			: options.channel
	const fetch = mock(async () => channel)
	const guild = {
		id: 'guild-1',
		name: 'Test Guild',
		channels: {
			cache: new Map(channel ? [['channel', channel]] : []),
			fetch,
		},
	} as unknown as Guild
	return { channel, edit, fetch, guild, message, send }
}

export function createFeedClient(guilds: Guild[] = [], send = mock(async () => ({}))) {
	const fetch = mock(async () => ({ send }))
	return {
		client: {
			guilds: { cache: new Map(guilds.map((guild) => [guild.id, guild])) },
			users: { fetch },
		} as unknown as Client,
		fetch,
		send,
	}
}

export const tournamentData = {
	active: {
		nodes: [
			{
				id: 5,
				slug: 'week-5',
				endAt: '2026-08-08T00:00:00Z',
				trackTournamentResults: { totalCount: 0, nodes: [] },
			},
		],
	},
}
