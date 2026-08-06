import { mock } from 'bun:test'
import type {
	AutocompleteInteraction,
	ButtonInteraction,
	ChatInputCommandInteraction,
	UserContextMenuCommandInteraction,
} from 'discord.js'
import type { DiscordBackendClient } from '../src/backend'
import { type CommandContext, createCommandRuntime } from '../src/commands/context'
import type { ZeepGraphqlClient } from '../src/graphql'
import type { DiscordBotConfig, DiscordUserState, LinkedUser } from '../src/types'

export const linkedUser: LinkedUser = {
	id: 7,
	steamId: '76561198000000007',
	steamName: 'Player Seven',
	discordId: 'discord-1',
}

export const unlinkedState: DiscordUserState = {
	linkedUser: null,
	preference: null,
	watches: [],
}

export const linkedState: DiscordUserState = {
	linkedUser,
	preference: { pingOnWorldRecordLoss: false },
	watches: [],
}

export const testConfig: DiscordBotConfig = {
	nodeEnv: 'test',
	clientId: 'client-id',
	botToken: 'bot-token',
	apiToken: 'discord-bot-api-test-token-at-least-32-chars',
	graphql: { httpUrl: 'https://graphql.example.test', wsUrl: 'wss://graphql.example.test' },
	backendUrl: 'https://backend.example.test',
	frontendUrl: 'https://frontend.example.test',
	health: { host: '127.0.0.1', port: 6000 },
	registerCommands: true,
}

export type BackendMocks = Record<keyof DiscordBackendClient, ReturnType<typeof mock>>
export type GraphqlMocks = Record<keyof ZeepGraphqlClient, ReturnType<typeof mock>>

export function createMockContext(
	options: {
		backend?: Partial<BackendMocks>
		graphql?: Partial<GraphqlMocks>
		monotonicTimes?: number[]
		now?: Date
		random?: number
	} = {},
) {
	const backend = {
		user: mock(async () => linkedState),
		redeem: mock(async () => ({ status: 'linked', idUser: linkedUser.id })),
		unlink: mock(async () => ({})),
		setPreference: mock(async () => ({})),
		addWatch: mock(async () => ({})),
		removeWatch: mock(async () => ({})),
		matchingWatches: mock(async () => []),
		updateWatchDelivery: mock(async () => ({})),
		workerCursor: mock(async () => ({ cursorEventId: '0' })),
		advanceWorkerCursor: mock(async () => ({})),
		guild: mock(async () => ({
			config: null,
			feeds: [],
			digest: null,
			tournamentMessages: [],
		})),
		setFeed: mock(async () => ({})),
		setLinkedRole: mock(async () => ({})),
		advanceFeed: mock(async () => ({})),
		setDelivery: mock(async () => ({})),
		delivery: mock(async () => null),
		setTournamentMessage: mock(async () => ({})),
		...options.backend,
	} as unknown as BackendMocks
	const graphql = {
		client: {},
		wsClient: {},
		query: mock(async () => ({})),
		activityEvents: mock(async () => []),
		subscribeToActivityEvents: mock(() => ({ unsubscribe: mock(() => {}) })),
		usersByIds: mock(async () => new Map()),
		userStats: mock(async () => ({})),
		modVersions: mock(async () => ({ versions: { nodes: [] }, records: { nodes: [] } })),
		levelById: mock(async () => null),
		userByFilter: mock(async () => null),
		recentWorkshopLevels: mock(async () => ({ levelItems: { nodes: [] } })),
		dispose: mock(() => {}),
		...options.graphql,
	} as unknown as GraphqlMocks
	const monotonicTimes = [...(options.monotonicTimes ?? [100, 125])]
	let id = 0
	const context = {
		backend: backend as unknown as DiscordBackendClient,
		config: testConfig,
		graphql: graphql as unknown as ZeepGraphqlClient,
		runtime: createCommandRuntime({
			id: () => `session-${++id}`,
			monotonicNow: () => monotonicTimes.shift() ?? 0,
			now: () => new Date(options.now ?? '2026-08-06T12:00:00.000Z'),
			random: () => options.random ?? 0,
		}),
	} satisfies CommandContext
	return { backend, context, graphql }
}

export type InteractionOptions = {
	booleans?: Record<string, boolean | null>
	channels?: Record<string, { id: string } | null>
	focused?: number | string | { value: number | string }
	guildId?: string | null
	integers?: Record<string, number | null>
	roles?: Record<string, { id: string } | null>
	strings?: Record<string, string | null>
	subcommand?: string
	userId?: string
	users?: Record<string, { id: string } | null>
}

export function createChatInteraction(commandName: string, values: InteractionOptions = {}) {
	const state: {
		defer?: unknown
		edit?: unknown
		reply?: unknown
	} = {}
	const interaction = {
		commandName,
		user: { id: values.userId ?? 'discord-1' },
		guildId: values.guildId ?? null,
		options: {
			getBoolean: (name: string) => values.booleans?.[name] ?? null,
			getChannel: (name: string) => values.channels?.[name] ?? null,
			getFocused: () => values.focused ?? '',
			getInteger: (name: string) => values.integers?.[name] ?? null,
			getRole: (name: string) => values.roles?.[name] ?? null,
			getString: (name: string) => values.strings?.[name] ?? null,
			getSubcommand: () => values.subcommand ?? '',
			getUser: (name: string) => values.users?.[name] ?? null,
		},
		deferReply: mock(async (input?: unknown) => {
			state.defer = input
		}),
		editReply: mock(async (input: unknown) => {
			state.edit = input
			return input
		}),
		reply: mock(async (input: unknown) => {
			state.reply = input
			return input
		}),
	} as unknown as ChatInputCommandInteraction
	return { interaction, state }
}

export function createAutocompleteInteraction(
	commandName: string,
	focused: InteractionOptions['focused'],
) {
	let response: unknown
	const interaction = {
		commandName,
		options: { getFocused: () => focused },
		respond: mock(async (input: unknown) => {
			response = input
		}),
	} as unknown as AutocompleteInteraction
	return { interaction, response: () => response }
}

export function createContextInteraction(commandName = 'ZeepCentraal profile') {
	const state: { edit?: unknown } = {}
	const interaction = {
		commandName,
		targetId: 'discord-2',
		deferReply: mock(async () => {}),
		editReply: mock(async (input: unknown) => {
			state.edit = input
		}),
	} as unknown as UserContextMenuCommandInteraction
	return { interaction, state }
}

export function createButtonInteraction(customId: string, userId = 'discord-1') {
	const state: { reply?: unknown; update?: unknown } = {}
	const interaction = {
		customId,
		user: { id: userId },
		reply: mock(async (input: unknown) => {
			state.reply = input
		}),
		update: mock(async (input: unknown) => {
			state.update = input
		}),
	} as unknown as ButtonInteraction
	return { interaction, state }
}
