import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { getTableColumns } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { lobby, lobbyHistory, lobbyStats } from './schema'

const migration = readFileSync(
	new URL('../drizzle/0079_sweet_silverclaw.sql', import.meta.url),
	'utf8',
)

describe('lobby persistence schema', () => {
	test('uses one row per master lobby independent of host', () => {
		const columns = getTableColumns(lobby)
		const config = getTableConfig(lobby)

		expect(columns.id.primary).toBe(true)
		expect(config.uniqueConstraints).toHaveLength(1)
		expect(config.uniqueConstraints[0]?.columns.map((column) => column.name)).toEqual([
			'master_id',
		])
		expect(config.primaryKeys).toHaveLength(0)
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				'isPublic',
				'peakPlayers',
				'peakTime',
				'firstSeen',
				'lastSeen',
				'closedAt',
			]),
		)
	})

	test('links lobby and history hosts to users', () => {
		const lobbyForeignKeys = getTableConfig(lobby).foreignKeys
		const historyForeignKeys = getTableConfig(lobbyHistory).foreignKeys

		expect(lobbyForeignKeys.map((key) => key.getName())).toEqual(['lobby_host_fkey'])
		expect(historyForeignKeys.map((key) => key.getName()).toSorted()).toEqual([
			'lobby_history_host_fkey',
			'lobby_history_lobby_fkey',
		])
		expect(getTableColumns(lobbyStats).id.primary).toBe(true)
	})

	test('exposes read-only GraphQL rows without master IDs', () => {
		const lobbyGrant = migration.match(
			/GRANT SELECT \((?<columns>[\s\S]*?)\) ON TABLE public\.lobby TO zeepcentraal_graphql/,
		)?.groups?.columns

		expect(migration).toContain("COMMENT ON COLUMN public.lobby.master_id IS E'@omit'")
		expect(migration).toContain('@fieldName host\\n@foreignFieldName hostedLobbies')
		expect(migration).toContain('@fieldName lobby\\n@foreignFieldName history')
		expect(lobbyGrant).toBeDefined()
		expect(lobbyGrant).toContain('room_name')
		expect(lobbyGrant).not.toContain('master_id')
		expect(migration).not.toContain('GRANT SELECT ON TABLE public.lobby TO')
		expect(migration).toContain(
			'GRANT SELECT ON TABLE public.lobby_history, public.lobby_stats TO zeepcentraal_graphql',
		)
	})
})
