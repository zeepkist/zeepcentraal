import { expect, mock, test } from 'bun:test'
import type { Client as UrqlClient } from '@urql/core'
import {
	Zc_DiscordTournamentLeaderboardDocument,
	Zc_DiscordTournamentSnapshotsDocument,
} from '@zeepkist/graphql/generated'
import { buildSchema, parse, print, validate } from 'graphql'
import type { Client as WsClient } from 'graphql-ws'
import { testConfig } from '../test/mocks'
import {
	createProductionGraphqlDependencies,
	createSubscriptionForwarder,
	discordReferenceDocuments,
	ZeepGraphqlClient,
} from './graphql'
import type { DiscordActivityEvent } from './types'

function createHarness(results: Array<{ data?: unknown; error?: unknown }> = []) {
	const query = mock((_document: unknown, variables: unknown) => ({
		toPromise: mock(async () => results.shift() ?? { data: {} }),
		variables,
	}))
	let subscriptionListener: ((result: { data?: unknown; error?: unknown }) => void) | undefined
	const subscriptionResult = { unsubscribe: mock(() => {}) }
	const subscription = mock((_document: unknown, _variables: unknown) => ({
		subscribe: mock((listener: typeof subscriptionListener) => {
			subscriptionListener = listener
			return subscriptionResult
		}),
	}))
	const urqlClient = { query, subscription } as unknown as UrqlClient
	const dispose = mock(() => {})
	const terminate = mock(() => {})
	const wsClient = {
		dispose,
		subscribe: mock(() => mock(() => {})),
		terminate,
	} as unknown as WsClient
	let clientOptions: Record<string, unknown> | undefined
	let wsOptions: Record<string, unknown> | undefined
	const client = new ZeepGraphqlClient(testConfig, {
		createClient: mock((options: Record<string, unknown>) => {
			clientOptions = options
			return urqlClient
		}) as never,
		createWsClient: mock((options: Record<string, unknown>) => {
			wsOptions = options
			return wsClient
		}) as never,
	})
	return {
		client,
		clientOptions: () => clientOptions,
		dispose,
		query,
		subscription,
		subscriptionListener: () => subscriptionListener,
		subscriptionResult,
		terminate,
		wsOptions: () => wsOptions,
	}
}

test('GraphQL production dependencies expose urql and graphql-ws factories', () => {
	const dependencies = createProductionGraphqlDependencies()
	expect(typeof dependencies.createClient).toBe('function')
	expect(typeof dependencies.createWsClient).toBe('function')
})

test('GraphQL client configures POST transport and retrying lazy subscriptions', () => {
	const harness = createHarness()
	expect(harness.clientOptions()).toMatchObject({
		url: testConfig.graphql.httpUrl,
		preferGetMethod: false,
		fetchOptions: { method: 'POST' },
	})
	const exchanges = harness.clientOptions()?.exchanges as unknown[] | undefined
	expect(exchanges?.length).toBe(2)
	expect(harness.wsOptions()).toMatchObject({
		url: testConfig.graphql.wsUrl,
		lazy: true,
		keepAlive: 30_000,
		retryAttempts: Number.POSITIVE_INFINITY,
	})
	const shouldRetry = harness.wsOptions()?.shouldRetry as (() => boolean) | undefined
	expect(shouldRetry?.()).toBe(true)
})

test('subscription forwarder validates query and returns websocket disposer', () => {
	const unsubscribe = mock(() => {})
	const subscribe = mock((_operation: unknown, _sink: unknown) => unsubscribe)
	const wsClient = { subscribe } as unknown as WsClient
	const forward = createSubscriptionForwarder(wsClient)
	const sink = { next: mock(() => {}), complete: mock(() => {}), error: mock(() => {}) }
	const subscription = forward(
		{ query: 'subscription { ping }', variables: { id: 1 } } as never,
		{} as never,
	)
	const result = subscription.subscribe(sink)
	expect(subscribe).toHaveBeenCalledTimes(1)
	expect(subscribe.mock.calls[0]?.[0]).toMatchObject({
		query: 'subscription { ping }',
		variables: { id: 1 },
	})
	result.unsubscribe()
	expect(unsubscribe).toHaveBeenCalledTimes(1)
	expect(() => forward({ query: undefined } as never, {} as never).subscribe(sink)).toThrow(
		'Subscription query is missing',
	)
})

test('raw Discord operations match reference GraphQL schema', async () => {
	const schema = buildSchema(
		await Bun.file(new URL('../../graphql/schema.graphql', import.meta.url)).text(),
	)
	const errors = discordReferenceDocuments.flatMap((document) => validate(schema, document))
	expect(errors.map((error) => error.message)).toEqual([])
})

test('generated Discord tournament operations stay schema-valid and minimal', async () => {
	const schema = buildSchema(
		await Bun.file(new URL('../../graphql/schema.graphql', import.meta.url)).text(),
	)
	const documents = [
		Zc_DiscordTournamentSnapshotsDocument,
		Zc_DiscordTournamentLeaderboardDocument,
	]
	expect(
		documents.flatMap((document) => validate(schema, document)).map((error) => error.message),
	).toEqual([])
	const snapshots = print(Zc_DiscordTournamentSnapshotsDocument)
	const leaderboard = print(Zc_DiscordTournamentLeaderboardDocument)
	expect(snapshots).toMatch(/weekly: trackTournaments\(\s*first: 1/)
	expect(snapshots).toMatch(/monthly: trackTournaments\(\s*first: 1/)
	expect(snapshots).toContain('trackTournamentResults(first: 3')
	expect(leaderboard).toContain('leaderboard: trackTournamentResults')
	for (const forbidden of [
		'ghostFeed',
		'updateFeed',
		'recordMedia',
		'personalBestGlobals',
		'worldRecordGlobals',
	]) {
		expect(snapshots).not.toContain(forbidden)
		expect(leaderboard).not.toContain(forbidden)
	}
})

test('query returns data and reports GraphQL and empty-data failures', async () => {
	const failure = new Error('GraphQL failed')
	const harness = createHarness([{ data: { ok: true } }, { error: failure }, {}])
	expect(await harness.client.query<{ ok: boolean }>(parse('query { ok }'))).toEqual({ ok: true })
	await expect(harness.client.query(parse('query { ok }'))).rejects.toBe(failure)
	await expect(harness.client.query(parse('query { ok }'))).rejects.toThrow(
		'GraphQL returned no data',
	)
})

test('activity event subscription emits full descending snapshots oldest first', () => {
	const event = {
		id: '9',
		kind: 'workshop',
		levelId: null,
		userId: null,
		previousUserId: null,
		recordId: null,
		previousRecordId: null,
		payload: '{"value":1}',
		occurredAt: '2026-08-06T00:00:00Z',
		level: null,
		user: null,
		previousUser: null,
		record: null,
		previousRecord: null,
	} as const
	const newerEvent = {
		...event,
		id: '10',
		kind: 'personal_best',
		payload: '{"value":2}',
	} as const
	const harness = createHarness()
	const onEvents = mock((_events: DiscordActivityEvent[]) => {})
	const live = harness.client.subscribeToActivityEvents(onEvents)
	harness.subscriptionListener()?.({ error: new Error('offline') })
	harness.subscriptionListener()?.({ data: undefined })
	harness.subscriptionListener()?.({ data: { discordActivityEvents: { nodes: [] } } })
	harness.subscriptionListener()?.({
		data: { discordActivityEvents: { nodes: [newerEvent, event] } },
	})
	expect(onEvents).toHaveBeenCalledTimes(1)
	expect(onEvents.mock.calls[0]?.[0]).toEqual([
		{ ...event, payload: { value: 1 } },
		{ ...newerEvent, payload: { value: 2 } },
	])
	const document = harness.subscription.mock.calls[0]?.[0]
	expect(print(document as never)).toContain('discordActivityEvents(first: 100')
	expect(print(document as never)).toContain('personalBestGlobals(first: 0)')
	expect(live).toBe(harness.subscriptionResult)
})

test('activity event subscription safely normalizes object and malformed payloads', () => {
	const harness = createHarness()
	const onEvents = mock((_events: DiscordActivityEvent[]) => {})
	harness.client.subscribeToActivityEvents(onEvents)
	harness.subscriptionListener()?.({
		data: {
			discordActivityEvents: {
				nodes: [
					{ id: '1', payload: { changes: [] } },
					{ id: '2', payload: 'not-json' },
					{ id: '3', payload: '[]' },
				],
			},
		},
	})
	const emitted = onEvents.mock.calls[0]?.[0]
	expect(emitted?.map(({ id, payload }) => ({ id, payload }))).toEqual([
		{ id: '3', payload: null },
		{ id: '2', payload: null },
		{ id: '1', payload: { changes: [] } },
	])
})

test('usersByIds skips empty requests, deduplicates, and batches by 100', async () => {
	const first = Array.from({ length: 100 }, (_, index) => ({
		id: index + 1,
		steamId: String(index + 1),
		steamName: `Player ${index + 1}`,
		discordId: null,
	}))
	const last = { id: 101, steamId: '101', steamName: 'Player 101', discordId: 'discord' }
	const harness = createHarness([
		{ data: { users: { nodes: first } } },
		{ data: { users: { nodes: [last] } } },
	])
	expect(await harness.client.usersByIds([])).toEqual(new Map())
	const users = await harness.client.usersByIds([
		...Array.from({ length: 101 }, (_, index) => index + 1),
		101,
	])
	expect(users.size).toBe(101)
	expect(users.get(101)).toEqual(last)
	expect(harness.query).toHaveBeenCalledTimes(2)
	const firstVariables = harness.query.mock.calls[0]?.[1] as { ids: number[] } | undefined
	const secondVariables = harness.query.mock.calls[1]?.[1] as { ids: number[] } | undefined
	expect(firstVariables?.ids).toHaveLength(100)
	expect(secondVariables?.ids).toEqual([101])
})

test('typed GraphQL helpers preserve variables and response shapes', async () => {
	const level = { id: 3 }
	const user = { id: 4 }
	const recent = {
		levelItems: {
			nodes: [
				{
					name: 'New level',
					imageUrl: 'image',
					fileUid: 'uid',
					fileAuthor: 'author',
					workshopId: 'workshop',
					createdAt: 'created',
					updatedAt: 'updated',
					level: null,
				},
			],
		},
	}
	const harness = createHarness([
		{ data: { records: { totalCount: 2 } } },
		{ data: { versions: { nodes: [] }, records: { nodes: [] } } },
		{ data: { level } },
		{ data: { level: null } },
		{ data: { users: { nodes: [user] } } },
		{ data: { users: { nodes: [] } } },
		{ data: recent },
	])
	expect(await harness.client.userStats(4, 'from', 'to')).toEqual({
		records: { totalCount: 2 },
	})
	expect(await harness.client.modVersions(4)).toEqual({
		versions: { nodes: [] },
		records: { nodes: [] },
	})
	expect(await harness.client.levelById(3)).toBe(level)
	expect(await harness.client.levelById(99)).toBeNull()
	expect(await harness.client.userByFilter({ id: { equalTo: 4 } })).toBe(user)
	expect(await harness.client.userByFilter({ discordId: { equalTo: 'missing' } })).toBeNull()
	expect(
		await harness.client.recentWorkshopLevels(
			{ publiclyVisible: { equalTo: true } },
			'UPDATED_AT_DESC',
			12,
		),
	).toEqual(recent)
	expect(harness.query.mock.calls.at(-1)?.[1]).toEqual({
		first: 12,
		levelFilter: { publiclyVisible: { equalTo: true } },
		orderBy: ['UPDATED_AT_DESC', 'ID_DESC'],
	})
	harness.client.dispose()
	expect(harness.dispose).toHaveBeenCalledTimes(1)
})
