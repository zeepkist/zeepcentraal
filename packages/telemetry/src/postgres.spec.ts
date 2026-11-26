import { beforeEach, expect, mock, test } from 'bun:test'
import type { SQL } from 'bun'

const measurements: Record<string, string>[] = []
const withActiveSpan = mock(() => {
	throw new Error('SQL must never start a span')
})
mock.module('./span', () => ({
	getMeter: () => ({
		createHistogram: () => ({
			record: (_duration: number, attributes: Record<string, string>) => {
				measurements.push(attributes)
			},
		}),
	}),
	withActiveSpan,
}))
const { createTracedPostgresClient } = await import('./postgres')

beforeEach(() => {
	measurements.length = 0
	withActiveSpan.mockClear()
})

function fixture(fail = false) {
	let executions = 0
	const helper = { values: [1, 2] }
	function pending() {
		let cancelled = false
		const query = {
			cancel() {
				cancelled = true
				return query
			},
			values() {
				return query
			},
			// biome-ignore lint/suspicious/noThenProperty: Simulates Bun's lazy thenable query.
			then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
				executions++
				return (
					fail || cancelled
						? Promise.reject(new Error('query failed'))
						: Promise.resolve([{ id: 1 }])
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

function expectMeasurement(outcome: string) {
	expect(measurements).toEqual([
		{ 'db.system.name': 'postgresql', 'db.operation.name': 'SELECT', outcome },
	])
	expect(withActiveSpan).not.toHaveBeenCalled()
}

test('query stays lazy and chaining/repeated awaiting produces one execution and measurement', async () => {
	const { client, executions } = fixture()
	const query = client.unsafe('select $1', [1]).values()
	expect(executions()).toBe(0)
	await query
	await query
	expect(executions()).toBe(1)
	expectMeasurement('ok')
})

test('parameter helpers stay intact; begin and savepoint clients retain metrics', async () => {
	const { client, helper } = fixture()
	expect(Object.is(client.array([1, 2], 'INTEGER'), helper)).toBe(true)
	await client.begin(async (tx) => {
		await tx.savepoint(async (nested) => {
			await nested`select ${1}`
		})
	})
	expectMeasurement('ok')
})

test('execute starts immediately and rejected queries record duration once', async () => {
	const { client, executions } = fixture(true)
	const query = client.unsafe('select $1', ['private']).execute()
	await expect(Promise.resolve(query)).rejects.toThrow('query failed')
	await expect(Promise.resolve(query)).rejects.toThrow('query failed')
	expect(executions()).toBe(1)
	expectMeasurement('database.error')
})

test('cancellation passes through and records a bounded outcome once', async () => {
	const { client, executions } = fixture()
	const query = client.unsafe('select $1', ['private']).execute()
	query.cancel()
	await expect(Promise.resolve(query)).rejects.toThrow('query failed')
	expect(executions()).toBe(1)
	expectMeasurement('cancelled')
})
