import { getMeter, SpanKind, type TelemetrySpan, withActiveSpan } from '@zeepkist/telemetry'
import type { Sql } from 'postgres'

const databaseDuration = getMeter('zeepcentraal-database').createHistogram(
	'db.client.operation.duration',
	{ description: 'Database client operation duration', unit: 's' },
)

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

function operationName(statement: string) {
	return (
		sanitizeSql(statement)
			.match(/^[a-z]+/i)?.[0]
			?.toUpperCase() ?? 'QUERY'
	)
}

function querySummary(statement: string) {
	return sanitizeSql(statement).slice(0, 255)
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
	if (resultCommand) span.setAttribute('db.operation.name', resultCommand)
	span.addEvent('db.response', {
		...(count !== undefined ? { 'db.response.returned_rows': count } : {}),
		...(resultCommand ? { 'db.operation.name': resultCommand } : {}),
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
			if (property === 'then') return execute().then.bind(execute())
			if (property === 'catch') return execute().catch.bind(execute())
			if (property === 'finally') return execute().finally.bind(execute())
			const value = Reflect.get(target, property, receiver)
			if (typeof value !== 'function') return value
			return (...args: unknown[]) => {
				const result = Reflect.apply(value, target, args)
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
	const operation = operationName(statement)
	const started = performance.now()
	return withActiveSpan(
		`${operation} ${url.pathname.slice(1) || 'postgres'}`,
		{
			kind: SpanKind.CLIENT,
			attributes: {
				'db.system.name': 'postgresql',
				'db.namespace': url.pathname.slice(1),
				'db.operation.name': operation,
				'db.query.summary': querySummary(statement),
				'db.query.text': sanitizeSql(statement),
				'server.address': url.hostname,
				'server.port': Number(url.port || 5432),
			},
		},
		async (span) => {
			try {
				return await callback(span)
			} finally {
				databaseDuration.record((performance.now() - started) / 1_000, {
					'db.system.name': 'postgresql',
					'db.operation.name': operation,
				})
			}
		},
	)
}

export function createTracedPostgresClient<T extends Sql<Record<string, unknown>>>(
	client: T,
	databaseUrl: string,
): T {
	return new Proxy(client, {
		apply(target, thisArg, args: unknown[]) {
			const result = Reflect.apply(target, thisArg, args) as PendingQuery
			const first = args[0]
			const statement = Array.isArray(first)
				? queryTextFromTemplate(first as unknown as TemplateStringsArray)
				: 'query'
			return wrapPendingQuery(result, statement, databaseUrl)
		},
		get(target, property, receiver) {
			const value = Reflect.get(target, property, receiver)
			if (typeof value !== 'function') return value
			if (property === 'unsafe') {
				return (statement: string, ...args: unknown[]) =>
					wrapPendingQuery(
						Reflect.apply(value, target, [statement, ...args]),
						statement,
						databaseUrl,
					)
			}
			if (property === 'begin') {
				return (...args: unknown[]) => {
					const callbackIndex = args.findIndex((arg) => typeof arg === 'function')
					if (callbackIndex >= 0) {
						const callback = args[callbackIndex] as (transaction: T) => unknown
						args[callbackIndex] = (transaction: T) =>
							traceDatabaseOperation('BEGIN', databaseUrl, async () =>
								callback(createTracedPostgresClient(transaction, databaseUrl)),
							)
					}
					return Reflect.apply(value, target, args)
				}
			}
			return value.bind(target)
		},
	}) as T
}
