import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { favourite } from '../schema'

let deleteCondition: SQL | undefined

const onConflictDoNothing = mock(async () => undefined)
const values = mock(() => ({ onConflictDoNothing }))
const insert = mock(() => ({ values }))
const where = mock(async (condition: SQL) => {
	deleteCondition = condition
})
const deleteRow = mock(() => ({ where }))

mock.module('../client', () => ({
	db: {
		delete: deleteRow,
		insert,
	},
}))

const { addFavourite, removeFavourite } = await import('./favourite')

describe('favourite mutations', () => {
	beforeEach(() => {
		deleteCondition = undefined
		deleteRow.mockClear()
		insert.mockClear()
		onConflictDoNothing.mockClear()
		values.mockClear()
		where.mockClear()
	})

	test('adds a favourite idempotently against the composite key', async () => {
		await addFavourite(7, 11)

		expect(insert).toHaveBeenCalledWith(favourite)
		expect(values).toHaveBeenCalledWith({ idUser: 7, idLevel: 11 })
		expect(onConflictDoNothing).toHaveBeenCalledWith({
			target: [favourite.idUser, favourite.idLevel],
		})
	})

	test('removes only the requested user and level pair', async () => {
		await removeFavourite(7, 11)

		expect(deleteRow).toHaveBeenCalledWith(favourite)
		expect(deleteCondition).toBeDefined()
		const query = new PgDialect().sqlToQuery(deleteCondition as SQL)
		expect(query.sql).toContain('"favourite"."id_user" =')
		expect(query.sql).toContain('"favourite"."id_level" =')
		expect(query.params).toEqual([7, 11])
	})
})
