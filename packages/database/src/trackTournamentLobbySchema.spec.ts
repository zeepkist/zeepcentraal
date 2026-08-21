import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { getTableColumns } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { managedLobby, trackTournamentLobbyAsset } from './schema'

const migration = readFileSync(
	new URL('../drizzle/0080_noisy_ultragirl.sql', import.meta.url),
	'utf8',
)

describe('private tournament lobby schema', () => {
	test('stores immutable asset metadata and stable managed join ID', () => {
		const assetColumns = getTableColumns(trackTournamentLobbyAsset)
		const managedColumns = getTableColumns(managedLobby)
		expect(assetColumns.idTournament.primary).toBe(true)
		expect(managedColumns.key.primary).toBe(true)
		expect(Object.keys(assetColumns)).toEqual(
			expect.arrayContaining([
				'workshopId',
				'fileUid',
				'objectKey',
				'contentSha256',
				'byteSize',
			]),
		)
		expect(getTableConfig(trackTournamentLobbyAsset).foreignKeys).toHaveLength(1)
	})

	test('creates both tables only in private schema', () => {
		expect(migration).toContain('CREATE TABLE "zc_private"."managed_lobby"')
		expect(migration).toContain('CREATE TABLE "zc_private"."track_tournament_lobby_asset"')
		expect(migration).not.toContain('GRANT')
		expect(migration).not.toContain('CREATE TABLE "managed_lobby"')
	})
})
