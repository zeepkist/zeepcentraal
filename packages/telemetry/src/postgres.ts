import { SpanKind } from '@opentelemetry/api'
import type { SQL } from 'bun'
import { getMeter, type TelemetrySpan, withActiveSpan } from './span'

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

function queryTextFromTemplate(strings: TemplateStringsArray) {
	return strings
		.map((part, index) => `${part}${index < strings.length - 1 ? `$${index + 1}` : ''}`)
		.join('')
}

function rowCount(result: unknown): number | undefined {
	if (Array.isArray(result)) return result.length
	if (!result || typeof result !== 'object') return undefined
	const count = Reflect.get(result, 'count')
	return typeof count === 'number' ? count : undefined
}

function command(result: unknown): string | undefined {
	if (!result || typeof result !== 'object') return undefined
	const value = Reflect.get(result, 'command')
	return typeof value === 'string' ? value : undefined
}

function completeSpan(span: TelemetrySpan, result: unknown) {
	const count = rowCount(result)
	const resultCommand = command(result)
	if (count !== undefined) span.setAttribute('db.response.returned_rows', count)
	if (resultCommand) span.setAttribute('db.operation.name', databaseOperation(resultCommand))
	span.addEvent('db.response', {
		...(count !== undefined ? { 'db.response.returned_rows': count } : {}),
		...(resultCommand ? { 'db.operation.name': databaseOperation(resultCommand) } : {}),
	})
}

type PendingQuery = PromiseLike<unknown> & Record<PropertyKey, unknown>

function wrapPendingQuery(
	query: PendingQuery,
	statement: string,
	databaseUrl: string,
): PendingQuery {
	let execution: Promise<unknown> | undefined
	const execute = () => {
		execution ??= traceDatabaseOperation(statement, databaseUrl, async (span) => {
			const result = await Promise.resolve(query)
			completeSpan(span, result)
			return result
		})
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
				if (result === target) return receiver
				return result && typeof result === 'object' && 'then' in result
					? wrapPendingQuery(result as PendingQuery, statement, databaseUrl)
					: result
			}
		},
	})
}

async function traceDatabaseOperation<T>(
	statement: string,
	databaseUrl: string,
	callback: (span: TelemetrySpan) => Promise<T>,
) {
	const url = new URL(databaseUrl)
	const operation = databaseOperation(statement)
	const started = performance.now()
	let outcome = 'ok'
	return withActiveSpan(
		`${operation} ${url.pathname.slice(1) || 'postgres'}`,
		{
			kind: SpanKind.CLIENT,
			shouldRecordError: () => false,
			attributes: {
				'db.system.name': 'postgresql',
				'db.system': 'postgresql',
				'db.name': url.pathname.slice(1),
				'db.operation': operation,
				'db.namespace': url.pathname.slice(1),
				'db.operation.name': operation,
				'server.address': url.hostname,
				'server.port': Number(url.port || 5432),
			},
		},
		async (span) => {
			try {
				return await callback(span)
			} catch (error) {
				outcome = 'error'
				span.setAttribute('error.type', 'database.error')
				span.setErrorStatus('Database operation failed')
				throw error
			} finally {
				databaseDuration ??= getMeter('zeepcentraal-database').createHistogram(
					'db.client.operation.duration',
					{ unit: 's' },
				)
				databaseDuration.record((performance.now() - started) / 1_000, {
					outcome,
					'db.system.name': 'postgresql',
					'db.system': 'postgresql',
					'db.name': url.pathname.slice(1),
					'db.operation': operation,
					'db.operation.name': operation,
				})
			}
		},
	)
}

export function createTracedPostgresClient<T extends SQL>(client: T, databaseUrl: string): T {
	return new Proxy(client, {
		apply(target, thisArg, args: unknown[]) {
			const result = Reflect.apply(target, thisArg, args) as PendingQuery
			const first = args[0]
			const statement = Array.isArray(first)
				? queryTextFromTemplate(first as unknown as TemplateStringsArray)
				: 'query'
			return result && typeof result === 'object' && 'then' in result
				? wrapPendingQuery(result, statement, databaseUrl)
				: result
		},
		get(target, property) {
			const value = Reflect.get(target, property, target)
			if (typeof value !== 'function') return value
			if (property === 'reserve') {
				return async (...args: unknown[]) =>
					createTracedPostgresClient(
						await Reflect.apply(value, target, args),
						databaseUrl,
					)
			}
			if (property === 'unsafe') {
				return (statement: string, ...args: unknown[]) =>
					wrapPendingQuery(
						Reflect.apply(value, target, [statement, ...args]),
						statement,
						databaseUrl,
					)
			}
			if (property === 'begin' || property === 'savepoint') {
				return (...args: unknown[]) => {
					const callbackIndex = args.findIndex((arg) => typeof arg === 'function')
					if (callbackIndex >= 0) {
						const callback = args[callbackIndex] as (transaction: T) => unknown
						args[callbackIndex] = (transaction: T) =>
							callback(createTracedPostgresClient(transaction, databaseUrl))
					}
					return Reflect.apply(value, target, args)
				}
			}
			return value.bind(target)
		},
	}) as T
}
