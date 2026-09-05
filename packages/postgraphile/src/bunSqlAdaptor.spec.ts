import { describe, expect, test } from 'bun:test'
import type { ReservedSQL } from 'bun'
import { BunPgClient, normalizeBunSqlError } from './bunSqlAdaptor'

function fixture() {
	const statements: string[] = []
	const sql = {
		unsafe(text: string) {
			statements.push(text)
			const rows = Object.assign([{ value: 'ok' }], { count: 3 })
			return Object.assign(Promise.resolve(rows), {
				values: () => Promise.resolve(Object.assign([['ok']], { count: 3 })),
			})
		},
	} as unknown as ReservedSQL
	return { client: new BunPgClient(sql), statements }
}

describe('Bun PostGraphile adapter', () => {
	test('maps object rows, array rows and affected row counts', async () => {
		const { client } = fixture()
		expect(await client.query({ text: 'select $1', values: ['ok'] })).toEqual({
			rows: [{ value: 'ok' }],
			rowCount: 3,
		})
		expect(
			await client.query({
				text: 'select $1',
				values: ['ok'],
				arrayMode: true,
				name: 'prepared',
			}),
		).toEqual({ rows: [['ok']], rowCount: 3 })
	})

	test('queues sibling queries behind nested transactions', async () => {
		const { client, statements } = fixture()
		await Promise.all([
			client.withTransaction(async (tx) => {
				await tx.query({ text: 'outer' })
				await tx.withTransaction(async (nested) => {
					await nested.query({ text: 'inner' })
				})
			}),
			client.query({ text: 'sibling' }),
		])
		expect(statements).toEqual([
			'BEGIN',
			'outer',
			'SAVEPOINT bun_tx_1',
			'inner',
			'RELEASE SAVEPOINT bun_tx_1',
			'COMMIT',
			'sibling',
		])
	})

	test('rolls back failures without poisoning subsequent queries', async () => {
		const { client, statements } = fixture()
		await expect(
			client.withTransaction(async () => {
				throw new Error('failure')
			}),
		).rejects.toThrow('failure')
		await client.query({ text: 'next' })
		expect(statements).toEqual(['BEGIN', 'ROLLBACK', 'next'])
	})

	test('normalizes native SQLSTATE and preserves diagnostics without mutating error', () => {
		const error = Object.assign(new Error('constraint failure'), {
			code: 'ERR_POSTGRES_SERVER_ERROR',
			errno: '23505',
			detail: 'fixture detail',
			hint: 'fixture hint',
		})
		const result = normalizeBunSqlError(error)
		expect(result).toMatchObject({
			code: '23505',
			detail: 'fixture detail',
			hint: 'fixture hint',
			cause: error,
		})
		expect(error.code).toBe('ERR_POSTGRES_SERVER_ERROR')
		expect(normalizeBunSqlError(new Error('network'))).toBeInstanceOf(Error)
	})
})

test('Bun service includes dedicated LISTEN connection within configured budget', async () => {
	const { makeBunPgService } = await import('./bunSqlAdaptor')
	const service = makeBunPgService({
		connectionString: 'postgres://fixture:password@localhost/test',
		schemas: ['public'],
		poolConfig: {
			max: 6,
			connectionTimeoutMillis: 5000,
			statement_timeout: 15000,
			lock_timeout: 3000,
			idle_in_transaction_session_timeout: 30000,
		},
	})
	expect(service.adaptorSettings?.pool.options.max).toBe(5)
	expect(service.adaptorSettings?.pool.options.prepare).toBe(false)
	await service.release?.()
	await service.release?.()
})
