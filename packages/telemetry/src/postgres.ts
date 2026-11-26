import type { SQL } from 'bun'
import { getMeter } from './span'

let databaseDuration: ReturnType<ReturnType<typeof getMeter>['createHistogram']> | undefined

const SQL_MAX_LENGTH = 4_096

export function sanitizeSql(statement: string) {
	return statement
		.replace(/--[^\r\n]*/g, ' ')
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/\$([a-z_][a-z0-9_]*)\$[\s\S]*?\$\1\$/gi, '?')
		.replace(/\$\$[\s\S]*?\$\$/g, '?')
		.replace(/'(?:''|[^'])*'/g, '?')
		.replace(/(?<!\$)\b\d+(?:\.\d+)?\b/g, '?')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, SQL_MAX_LENGTH)
}

export function databaseOperation(statement: string) {
	const keyword = statement
		.trimStart()
		.match(/^[a-z]+/i)?.[0]
		?.toUpperCase()
	return [
		'SELECT',
		'INSERT',
		'UPDATE',
		'DELETE',
		'BEGIN',
		'COMMIT',
		'ROLLBACK',
		'SAVEPOINT',
		'RELEASE',
		'SET',
	].includes(keyword ?? '')
		? (keyword as string)
		: 'QUERY'
}

type PendingQuery = PromiseLike<unknown> & Record<PropertyKey, unknown>

function wrapPendingQuery(query: PendingQuery, operation: string): PendingQuery {
	let execution: Promise<unknown> | undefined
	let cancellationRequested = false
	const execute = () => {
		execution ??= (async () => {
			const started = performance.now()
			let outcome = 'ok'
			try {
				return await query
			} catch (error) {
				const code =
					error && typeof error === 'object' ? Reflect.get(error, 'code') : undefined
				const errno =
					error && typeof error === 'object' ? Reflect.get(error, 'errno') : undefined
				outcome =
					cancellationRequested || code === '57014' || errno === '57014'
						? 'cancelled'
						: 'database.error'
				throw error
			} finally {
				databaseDuration ??= getMeter('zeepcentraal-database').createHistogram(
					'db.client.operation.duration',
					{ unit: 's' },
				)
				databaseDuration.record((performance.now() - started) / 1_000, {
					'db.system.name': 'postgresql',
					'db.operation.name': operation,
					outcome,
				})
			}
		})()
		return execution
	}

	return new Proxy(query, {
		get(target, property, receiver) {
			if (property === 'execute')
				return () => {
					void execute().catch(() => {})
					return receiver
				}
			if (property === 'then') return execute().then.bind(execute())
			if (property === 'catch') return execute().catch.bind(execute())
			if (property === 'finally') return execute().finally.bind(execute())
			const value = Reflect.get(target, property, target)
			if (typeof value !== 'function') return value
			return (...args: unknown[]) => {
				const result = Reflect.apply(value, target, args)
				if (property === 'cancel') cancellationRequested = true
				if (result === target) return receiver
				return result && typeof result === 'object' && 'then' in result
					? wrapPendingQuery(result as PendingQuery, operation)
					: result
			}
		},
	})
}

export function createTracedPostgresClient<T extends SQL>(client: T, _databaseUrl?: string): T {
	return new Proxy(client, {
		apply(target, thisArg, args: unknown[]) {
			const result = Reflect.apply(target, thisArg, args) as PendingQuery
			const first = args[0]
			const operation = Array.isArray(first) ? databaseOperation(first[0] ?? '') : 'QUERY'
			return result && typeof result === 'object' && 'then' in result
				? wrapPendingQuery(result, operation)
				: result
		},
		get(target, property) {
			const value = Reflect.get(target, property, target)
			if (typeof value !== 'function') return value
			if (property === 'reserve') {
				return async (...args: unknown[]) =>
					createTracedPostgresClient(await Reflect.apply(value, target, args))
			}
			if (property === 'unsafe') {
				return (statement: string, ...args: unknown[]) =>
					wrapPendingQuery(
						Reflect.apply(value, target, [statement, ...args]),
						databaseOperation(statement),
					)
			}
			if (property === 'begin' || property === 'savepoint') {
				return (...args: unknown[]) => {
					const callbackIndex = args.findIndex((arg) => typeof arg === 'function')
					if (callbackIndex >= 0) {
						const callback = args[callbackIndex] as (transaction: T) => unknown
						args[callbackIndex] = (transaction: T) =>
							callback(createTracedPostgresClient(transaction))
					}
					return Reflect.apply(value, target, args)
				}
			}
			return value.bind(target)
		},
	}) as T
}
