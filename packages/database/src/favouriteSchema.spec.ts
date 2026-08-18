import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { getTableColumns } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { favourite } from './schema'

const migration = readFileSync(
	new URL('../drizzle/0078_motionless_plazm.sql', import.meta.url),
	'utf8',
)

describe('favourite schema', () => {
	test('uses user and level as the composite primary key', () => {
		const columns = getTableColumns(favourite)
		const config = getTableConfig(favourite)

		expect(Object.keys(columns).toSorted()).toEqual([
			'dateCreated',
			'dateUpdated',
			'idLevel',
			'idUser',
		])
		expect(config.primaryKeys).toHaveLength(1)
		expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			'id_user',
			'id_level',
		])
		expect(config.uniqueConstraints).toHaveLength(0)
	})

	test('retains level lookup index and cascading foreign keys', () => {
		const config = getTableConfig(favourite)

		expect(config.indexes.map((index) => index.config.name)).toContain('IX_favorites_level')
		expect(
			config.foreignKeys.map((foreignKey) => ({
				columns: foreignKey.reference().columns.map((column) => column.name),
				name: foreignKey.getName(),
				onDelete: foreignKey.onDelete,
			})),
		).toEqual([
			{ columns: ['id_level'], name: 'favorite_level_fkey', onDelete: 'cascade' },
			{ columns: ['id_user'], name: 'favorites_user_foreign', onDelete: 'cascade' },
		])
	})

	test('migration removes the old primary key before adding the composite key', () => {
		const dropUnique = migration.indexOf('DROP CONSTRAINT "UQ_favourites_user_level"')
		const dropId = migration.indexOf('DROP COLUMN "id"')
		const addPrimaryKey = migration.indexOf(
			'ADD CONSTRAINT "favourite_id_user_id_level_pk" PRIMARY KEY("id_user","id_level")',
		)

		expect(dropUnique).toBeGreaterThanOrEqual(0)
		expect(dropId).toBeGreaterThan(dropUnique)
		expect(addPrimaryKey).toBeGreaterThan(dropId)
	})
})
