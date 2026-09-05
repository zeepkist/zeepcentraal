import { beforeEach, expect, mock, test } from 'bun:test'
import type { SQL } from 'bun'

const statements: string[] = []
let durations = 0
mock.module('@zeepkist/telemetry', () => ({
	SpanKind: { CLIENT: 2 },
	getMeter: () => ({
		createHistogram: () => ({
			record: () => {
				durations++
			},
		}),
	}),
	withActiveSpan: async (
		_name: string,
		options: { attributes: Record<string, string> },
		callback: (span: object) => unknown,
	) => {
		statements.push(options.attributes['db.query.text'] ?? '')
		return callback({ setAttribute() {}, addEvent() {} })
	},
}))
const { createTracedPostgresClient } = await import('./telemetry')

beforeEach(() => {
	statements.length = 0
	durations = 0
})

function fixture(fail = false) {
	let executions = 0
	const helper = { values: [1, 2] }
	function pending() {
		const query = {
			values() {
				return query
			},
			// biome-ignore lint/suspicious/noThenProperty: Simulates Bun's lazy thenable query.
			then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
				executions++
				return (
					fail ? Promise.reject(new Error('query failed')) : Promise.resolve([{ id: 1 }])
				).then(resolve, reject)
			},
		}
		return query
	}
	const raw = Object.assign(() => pending(), {
		unsafe: () => pending(),
		array: () => helper,
		begin: async (callback: (sql: unknown) => unknown) => callback(raw),
		savepoint: async (callback: (sql: unknown) => unknown) => callback(raw),
	})
	return {
		client: createTracedPostgresClient(
			raw as unknown as SQL,
			'postgres://fixture:password@localhost/test',
		),
		helper,
		executions: () => executions,
	}
}

test('query stays lazy and chaining/repeated awaiting produces one execution and span', async () => {
	const { client, executions } = fixture()
	const query = client.unsafe('select $1', [1]).values()
	expect(executions()).toBe(0)
	await query
	await query
	expect(executions()).toBe(1)
	expect(statements).toEqual(['select $1'])
	expect(durations).toBe(1)
})

test('parameter helpers stay intact; begin and savepoint clients remain traced', async () => {
	const { client, helper } = fixture()
	expect(Object.is(client.array([1, 2], 'INTEGER'), helper)).toBe(true)
	await client.begin(async (tx) => {
		await tx.savepoint(async (nested) => {
			await nested`select ${1}`
		})
	})
	expect(statements).toEqual(['BEGIN', 'SAVEPOINT', 'select $1'])
})

test('execute starts tracing immediately and rejected queries record duration once', async () => {
	const { client, executions } = fixture(true)
	const query = client.unsafe('select $1', ['private']).execute()
	await expect(Promise.resolve(query)).rejects.toThrow('query failed')
	await expect(Promise.resolve(query)).rejects.toThrow('query failed')
	expect(executions()).toBe(1)
	expect(durations).toBe(1)
	expect(statements).toEqual(['select $1'])
})
