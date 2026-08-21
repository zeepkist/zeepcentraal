import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { LobbyPacket, WireLobby } from '@zeepkist/core/zeepnet'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { lobby, lobbyHistory, lobbyStats } from '../schema'

const selectResults: unknown[][] = []
const returningResults: unknown[][] = []

interface InsertRecord {
	conflict?: unknown
	table: unknown
	values?: unknown
}

interface UpdateRecord {
	set?: Record<string, unknown>
	table: unknown
	where?: unknown
}

const insertRecords: InsertRecord[] = []
const updateRecords: UpdateRecord[] = []

function createSelectBuilder() {
	const builder = {
		from: mock(() => builder),
		where: mock(() => builder),
		orderBy: mock(() => builder),
		limit: mock(() => builder),
		// biome-ignore lint/suspicious/noThenProperty: Drizzle query builders are thenable.
		then: mock((resolve: (rows: unknown[]) => unknown) =>
			Promise.resolve(resolve(selectResults.shift() ?? [])),
		),
	}
	return builder
}

function createInsertBuilder(table: unknown) {
	const record: InsertRecord = { table }
	insertRecords.push(record)
	const builder = {
		values: mock((values: unknown) => {
			record.values = values
			return builder
		}),
		onConflictDoUpdate: mock((conflict: unknown) => {
			record.conflict = conflict
			return builder
		}),
		returning: mock(async () => returningResults.shift() ?? []),
		// biome-ignore lint/suspicious/noThenProperty: Drizzle query builders are thenable.
		then: mock((resolve: (value: undefined) => unknown) => Promise.resolve(resolve(undefined))),
	}
	return builder
}

function createUpdateBuilder(table: unknown) {
	const record: UpdateRecord = { table }
	updateRecords.push(record)
	const builder = {
		set: mock((values: Record<string, unknown>) => {
			record.set = values
			return builder
		}),
		where: mock((condition: unknown) => {
			record.where = condition
			return builder
		}),
		// biome-ignore lint/suspicious/noThenProperty: Drizzle query builders are thenable.
		then: mock((resolve: (value: undefined) => unknown) => Promise.resolve(resolve(undefined))),
	}
	return builder
}

const tx = {
	execute: mock(async () => {}),
	select: mock(() => createSelectBuilder()),
	insert: mock((table: unknown) => createInsertBuilder(table)),
	update: mock((table: unknown) => createUpdateBuilder(table)),
}

const db = {
	transaction: mock(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
		callback(tx),
	),
}

mock.module('../client', () => ({ db }))

const { persistLobbyPacket } = await import('./lobby')

const observedAt = '2026-08-21T00:00:00.000Z'

const wireLobby = (overrides: Partial<WireLobby> = {}): WireLobby => ({
	id: 'master-room-1',
	title: 'Room',
	host: { steamId: '76561198000000001', name: 'Host' },
	players: 3,
	playerLimit: 64,
	isPublic: true,
	...overrides,
})

const persistedLobby = (overrides: Record<string, unknown> = {}) => ({
	id: 7n,
	masterId: 'master-room-1',
	roomName: 'Room',
	hostId: 76561198000000001n,
	players: 3,
	playerLimit: 64,
	isPublic: true,
	peakPlayers: 8,
	peakTime: '2026-08-20T00:00:00.000Z',
	firstSeen: '2026-08-19T00:00:00.000Z',
	lastSeen: '2026-08-20T00:00:00.000Z',
	closedAt: null,
	dateCreated: '2026-08-19T00:00:00.000Z',
	dateUpdated: '2026-08-20T00:00:00.000Z',
	...overrides,
})

function insertFor(table: unknown) {
	return insertRecords.find((record) => record.table === table)
}

describe('lobby packet persistence', () => {
	beforeEach(() => {
		selectResults.length = 0
		returningResults.length = 0
		insertRecords.length = 0
		updateRecords.length = 0
		db.transaction.mockClear()
		tx.execute.mockClear()
		tx.select.mockClear()
		tx.insert.mockClear()
		tx.update.mockClear()
	})

	test('stores statistics only when aggregate values change', async () => {
		const packet: LobbyPacket = {
			type: 'statistics',
			onlinePlayers: 20,
			lobbyCount: 4,
			playersInLobbies: 12,
		}
		selectResults.push([])
		await persistLobbyPacket(packet, observedAt)

		expect(insertFor(lobbyStats)?.values).toEqual({
			players: 20,
			rooms: 4,
			playersInRooms: 12,
			dateCreated: observedAt,
			dateUpdated: observedAt,
		})

		insertRecords.length = 0
		selectResults.push([{ players: 20, rooms: 4, playersInRooms: 12 }])
		await persistLobbyPacket(packet, observedAt)
		expect(insertFor(lobbyStats)).toBeUndefined()
	})

	test('opens one lobby row and matching history snapshot', async () => {
		const entry = wireLobby()
		selectResults.push([])
		returningResults.push([{ id: 7n, masterId: entry.id }])

		await persistLobbyPacket({ type: 'list', lobbies: [entry] }, observedAt)

		expect(insertFor(lobby)?.values).toEqual([
			expect.objectContaining({
				masterId: entry.id,
				hostId: 76561198000000001n,
				peakPlayers: 3,
				peakTime: observedAt,
				firstSeen: observedAt,
				lastSeen: observedAt,
				closedAt: null,
			}),
		])
		expect(insertFor(lobbyHistory)?.values).toEqual([
			expect.objectContaining({ lobbyId: 7n, changeType: 'opened' }),
		])
	})

	test('records host transfer on same master lobby row', async () => {
		const entry = wireLobby({
			host: { steamId: '76561198000000002', name: 'New Host' },
		})
		selectResults.push([persistedLobby()])
		returningResults.push([{ id: 7n, masterId: entry.id }])

		await persistLobbyPacket({ type: 'update', operation: 'updated', lobby: entry }, observedAt)

		const lobbyInsert = insertFor(lobby)
		expect(lobbyInsert?.values).toEqual([
			expect.objectContaining({ masterId: entry.id, hostId: 76561198000000002n }),
		])
		expect(lobbyInsert?.conflict).toEqual(expect.objectContaining({ target: lobby.masterId }))
		expect(insertFor(lobbyHistory)?.values).toEqual([
			expect.objectContaining({
				lobbyId: 7n,
				hostId: 76561198000000002n,
				changeType: 'updated',
			}),
		])
	})

	test('keeps first peak time unless player count is strictly higher', async () => {
		const entry = wireLobby()
		selectResults.push([persistedLobby()])
		returningResults.push([{ id: 7n, masterId: entry.id }])

		await persistLobbyPacket({ type: 'update', operation: 'updated', lobby: entry }, observedAt)

		const conflict = insertFor(lobby)?.conflict as
			| { set: { peakPlayers: SQL; peakTime: SQL } }
			| undefined
		const dialect = new PgDialect()
		expect(conflict?.set).not.toHaveProperty('firstSeen')
		expect(dialect.sqlToQuery(conflict?.set.peakPlayers as SQL).sql).toContain(
			'excluded.players > "lobby"."peak_players"',
		)
		expect(dialect.sqlToQuery(conflict?.set.peakTime as SQL).sql).toContain(
			'excluded.players > "lobby"."peak_players"',
		)
	})

	test('closes active lobbies missing from authoritative lists without moving last seen', async () => {
		selectResults.push([persistedLobby()])

		await persistLobbyPacket({ type: 'list', lobbies: [] }, observedAt)

		expect(updateRecords).toHaveLength(1)
		expect(updateRecords[0]?.set).toEqual({
			closedAt: observedAt,
			dateUpdated: observedAt,
		})
		expect(insertFor(lobbyHistory)?.values).toEqual([
			expect.objectContaining({ lobbyId: 7n, changeType: 'closed' }),
		])
	})

	test('reopens existing master lobby and retains row identity', async () => {
		const entry = wireLobby()
		selectResults.push([persistedLobby({ closedAt: '2026-08-20T12:00:00.000Z' })])
		returningResults.push([{ id: 7n, masterId: entry.id }])

		await persistLobbyPacket({ type: 'update', operation: 'added', lobby: entry }, observedAt)

		expect(insertFor(lobbyHistory)?.values).toEqual([
			expect.objectContaining({ lobbyId: 7n, changeType: 'reopened' }),
		])
	})
})
