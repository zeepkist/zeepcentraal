import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { createHash } from 'node:crypto'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const rows: unknown[][] = []
let whereCondition: SQL | undefined

function createSelectBuilder() {
	const builder = {
		from: mock(() => builder),
		innerJoin: mock(() => builder),
		where: mock((condition: SQL) => {
			whereCondition = condition
			return builder
		}),
		limit: mock(async () => rows.shift() ?? []),
	}
	return builder
}

const db = {
	select: mock(() => createSelectBuilder()),
}

mock.module('../client', () => ({ db }))

const { getRefreshableWebSession, getWebSession } = await import('./auth')

describe('getWebSession', () => {
	beforeEach(() => {
		rows.length = 0
		whereCondition = undefined
		db.select.mockClear()
	})

	test('requires matching tokens, expiry timestamps, Steam ID, and ban state', async () => {
		rows.push([
			{
				id: 1,
				steamId: 76561198000000000n,
				steamName: 'Zeep',
				discordId: null,
				accessTokenExpiry: 2_000_000_000n,
			},
		])

		const session = await getWebSession({
			steamId: '76561198000000000',
			accessToken: 'access-token',
			refreshToken: 'refresh-token',
		})

		expect(session?.id).toBe(1)
		expect(whereCondition).toBeDefined()
		const query = new PgDialect().sqlToQuery(whereCondition as SQL)
		expect(query.sql).toContain('"auth"."access_token" =')
		expect(query.sql).toContain('"auth"."refresh_token_hash" =')
		expect(query.sql).toContain('"auth"."access_token_expiry" is not null')
		expect(query.sql).toContain('"auth"."access_token_expiry" >')
		expect(query.sql).toContain('"auth"."refresh_token_expiry" >')
		expect(query.sql).toContain('"user"."steam_id" =')
		expect(query.sql).toContain('"user"."banned" =')
		expect(query.params).toContain('access-token')
		expect(query.params).toContain(createHash('sha256').update('refresh-token').digest('hex'))
		expect(query.params).toContain(76561198000000000n)
		expect(query.params).toContain(false)
	})

	test('rejects malformed Steam IDs before querying', async () => {
		const session = await getWebSession({
			steamId: 'invalid',
			accessToken: 'access-token',
			refreshToken: 'refresh-token',
		})

		expect(session).toBeNull()
		expect(db.select).not.toHaveBeenCalled()
	})

	test('returns null when no current auth row matches', async () => {
		rows.push([])
		expect(
			await getWebSession({
				steamId: '76561198000000000',
				accessToken: 'wrong-access-token',
				refreshToken: 'wrong-refresh-token',
			}),
		).toBeNull()
	})

	test('authorizes repair using only a current refresh token, Steam ID, and ban state', async () => {
		rows.push([{ id: 10 }])
		expect(
			await getRefreshableWebSession({
				steamId: '76561198000000000',
				refreshToken: 'refresh-token',
			}),
		).toBe(true)

		const query = new PgDialect().sqlToQuery(whereCondition as SQL)
		expect(query.sql).toContain('"auth"."refresh_token_hash" =')
		expect(query.sql).toContain('"auth"."refresh_token_expiry" >')
		expect(query.sql).toContain('"user"."steam_id" =')
		expect(query.sql).toContain('"user"."banned" =')
		expect(query.sql).not.toContain('"auth"."access_token" =')
		expect(query.params).toContain(createHash('sha256').update('refresh-token').digest('hex'))
		expect(query.params).toContain(76561198000000000n)
		expect(query.params).toContain(false)
	})

	test('rejects unknown and malformed refresh sessions', async () => {
		rows.push([])
		expect(
			await getRefreshableWebSession({
				steamId: '76561198000000000',
				refreshToken: 'unknown-refresh-token',
			}),
		).toBe(false)
		expect(
			await getRefreshableWebSession({
				steamId: 'invalid',
				refreshToken: 'refresh-token',
			}),
		).toBe(false)
	})
})
